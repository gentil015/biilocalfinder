import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { WorkspaceContextService } from '../common/workspace/workspace-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  STORAGE_SERVICE,
  StorageService,
} from '../files/storage.interface';
import { sniffMime } from '../verification/file-sniffer';
import { StartConversationDto } from './dto/start-conversation.dto';
import { MAX_MESSAGE_ATTACHMENTS, MessageAttachmentRefDto } from './dto/send-message.dto';

export const MESSAGE_ATTACHMENT_PREFIX = 'message-attachments';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  attachments: true,
};

// Participants are always needed to render a thread header, and the linked
// request is what ties a conversation to a quote/history in the UI.
const CONVERSATION_INCLUDE = {
  participants: {
    include: {
      client: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
      provider: {
        select: {
          id: true,
          businessName: true,
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  },
  serviceRequest: { select: { id: true, title: true, status: true } },
} as const;

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private providerContext: ProviderContextService,
    private notifications: NotificationsService,
    private workspaceContext?: WorkspaceContextService,
    @Inject(STORAGE_SERVICE) private storage?: StorageService,
  ) {}

  // Single conversation per (client, provider) pair. A client who already has
  // a thread with a provider — including one created by posting a service
  // request — must land back in it rather than starting a duplicate, so
  // this reuses the existing conversation and just appends the new message.
  async startConversation(userId: string, dto: StartConversationDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!clientProfile) {
      throw new ForbiddenException('Only client accounts can start a conversation with a provider');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
      select: { id: true, userId: true, businessName: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    // Messaging yourself is never useful and would create a single-sided thread.
    if (provider.userId === userId) {
      throw new ForbiddenException('You cannot start a conversation with yourself');
    }

    const existing = await this.prisma.conversation.findFirst({
      // Two separate `some` clauses on the same relation have to be combined
      // with AND — repeating the `participants` key would just overwrite the
      // first condition.
      where: {
        AND: [
          { participants: { some: { clientId: clientProfile.id } } },
          { participants: { some: { providerId: provider.id } } },
        ],
      },
      select: { id: true },
    });

    let conversationId: string;
    let created = false;

    if (existing) {
      conversationId = existing.id;
    } else {
      const conversation = await this.prisma.conversation.create({
        data: {
          // serviceRequestId is intentionally left null: this is a direct
          // enquiry, not a quote trail. The column is nullable for exactly
          // this case.
          participants: {
            create: [{ clientId: clientProfile.id }, { providerId: provider.id }],
          },
        },
        select: { id: true },
      });
      conversationId = conversation.id;
      created = true;
    }

    let firstMessage = null;
    if (dto.body) {
      firstMessage = await this.sendMessage(conversationId, userId, dto.body.trim());
    }

    const conversation = await this.getConversation(conversationId, userId);
    return { ...conversation, created, message: firstMessage };
  }

  async getConversation(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async listConversations(userId: string) {
    const [clientProfile, providerIds] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId } }),
      this.providerContext.getProviderIdsForUser(userId),
    ]);

    const active = this.workspaceContext?.getForUser(userId);
    const isMember = active?.role === 'MEMBER';
    const memberScope = isMember
      ? {
          AND: [
            {
              OR: [
                { serviceRequest: { assignedMembershipId: active.membershipId } },
                ...(clientProfile ? [{ participants: { some: { clientId: clientProfile.id } } }] : []),
              ],
            },
          ],
        }
      : {};

    return this.prisma.conversation.findMany({
      where: {
        ...memberScope,
        participants: {
          some: {
            OR: [
              ...(clientProfile ? [{ clientId: clientProfile.id }] : []),
              ...providerIds.map((providerId) => ({ providerId })),
            ],
          },
        },
      },
      include: {
        participants: {
          include: {
            client: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            provider: { select: { id: true, businessName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { attachments: { take: 1 } },
        },
        serviceRequest: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async listMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  // Images, videos, and voice notes share one upload endpoint so the composer
  // can attach any of them without a mode switch. MIME is sniffed from the
  // bytes (the declared type only disambiguates shared containers), and each
  // media kind keeps its own size limit.
  async uploadAttachment(conversationId: string, userId: string, file: Express.Multer.File | undefined) {
    await this.assertParticipant(conversationId, userId);
    if (!file) throw new BadRequestException('No file provided');

    const mime = sniffMime(file.buffer, file.mimetype);
    const isImage = !!mime && ALLOWED_IMAGE_MIME_TYPES.includes(mime);
    const isVideo = !!mime && ALLOWED_VIDEO_MIME_TYPES.includes(mime);
    const isAudio = !!mime && ALLOWED_AUDIO_MIME_TYPES.includes(mime);
    if (!mime || (!isImage && !isVideo && !isAudio)) {
      throw new BadRequestException(
        'Only images (JPEG, PNG, WebP), videos (MP4, WebM, MOV), and voice notes are allowed',
      );
    }
    if (isImage && file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Images must be 8 MB or smaller');
    }
    if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) {
      throw new BadRequestException('Videos must be 100 MB or smaller');
    }
    if (isAudio && file.size > MAX_AUDIO_UPLOAD_BYTES) {
      throw new BadRequestException('Voice notes must be 25 MB or smaller');
    }
    if (!this.storage) throw new Error('Storage service unavailable');

    // Namespaced by conversation and sender so sendMessage below can reject
    // a key the sender did not upload for this thread.
    const result = await this.storage.upload(
      file.buffer,
      file.originalname,
      mime,
      `${MESSAGE_ATTACHMENT_PREFIX}/${conversationId}/${userId}`,
    );
    return { storageKey: result.key, url: result.url, mimeType: mime, sizeBytes: file.size };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    body?: string | null,
    attachments: MessageAttachmentRefDto[] = [],
  ) {
    await this.assertParticipant(conversationId, senderId);

    const text = body?.trim() ?? '';
    if (attachments.length > MAX_MESSAGE_ATTACHMENTS) {
      throw new BadRequestException(`A message can include at most ${MAX_MESSAGE_ATTACHMENTS} attachments`);
    }
    if (!text && attachments.length === 0) {
      throw new BadRequestException('A message needs text or at least one attachment');
    }

    const attachmentPrefix = `${MESSAGE_ATTACHMENT_PREFIX}/${conversationId}/${senderId}/`;
    const seenKeys = new Set<string>();
    for (const attachment of attachments) {
      if (!attachment.storageKey.startsWith(attachmentPrefix) || attachment.storageKey.includes('..')) {
        throw new BadRequestException('Invalid attachment reference');
      }
      if (seenKeys.has(attachment.storageKey)) {
        throw new BadRequestException('The same attachment was included twice');
      }
      seenKeys.add(attachment.storageKey);
    }

    if (attachments.length > 0 && !this.storage) throw new Error('Storage service unavailable');
    const stats = await Promise.all(
      attachments.map((attachment) => this.storage!.statObject(attachment.storageKey)),
    );
    if (stats.some((stat) => !stat)) {
      throw new BadRequestException('One or more attachments were not found. Upload them again.');
    }

    const attachmentData = attachments.map((attachment, index) => ({
      storageKey: attachment.storageKey,
      url: this.storage!.getUrl(attachment.storageKey),
      mimeType: stats[index]!.mimeType,
      sizeBytes: stats[index]!.sizeBytes,
    }));

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          body: text || null,
          ...(attachmentData.length > 0 ? { attachments: { create: attachmentData } } : {}),
        },
        include: MESSAGE_INCLUDE,
      }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);

    // Every reply — not just the opening message of a new thread — notifies
    // the other participants. Both the socket gateway and the REST fallback
    // call this one method, so notifications can't drift between the two
    // transports.
    const recipientIds = await this.otherParticipantUserIds(conversationId, senderId);
    if (recipientIds.length > 0) {
      const senderName =
        `${message.sender?.firstName ?? ''} ${message.sender?.lastName ?? ''}`.trim() || 'Someone';
      const preview = text
        ? text.slice(0, 140)
        : attachmentData.length === 1
          ? attachmentData[0].mimeType.startsWith('video/')
            ? 'Sent a video'
            : attachmentData[0].mimeType.startsWith('audio/')
              ? 'Sent a voice note'
              : 'Sent a photo'
          : `Sent ${attachmentData.length} attachments`;
      await Promise.all(
        recipientIds.map((userId) =>
          this.notifications.notify({
            userId,
            type: 'NEW_MESSAGE',
            title: 'New message',
            body: `${senderName}: ${preview}`,
            data: { conversationId },
          }),
        ),
      );
    }

    return message;
  }

  async markRead(conversationId: string, userId: string) {
    const participant = await this.assertParticipant(conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    });
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  // Returns the participant row (also used to identify the *other*
  // participant's user id for targeted notifications/presence).
  async assertParticipant(conversationId: string, userId: string) {
    const [clientProfile, providerIds] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId } }),
      this.providerContext.getProviderIdsForUser(userId),
    ]);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        OR: [
          ...(clientProfile ? [{ clientId: clientProfile.id }] : []),
          ...providerIds.map((providerId) => ({ providerId })),
        ],
      },
    });
    if (!participant) throw new ForbiddenException('Not a participant in this conversation');
    const active = this.workspaceContext?.getForUser(userId);
    const isOwnClientThread = !!clientProfile && participant.clientId === clientProfile.id;
    if (!isOwnClientThread) {
      // The REST controller supplies a workspace context; the socket gateway
      // does not. Fall back to the membership for the provider on this thread
      // so a MEMBER cannot bypass assignment scoping by using the socket.
      let memberScope: { membershipId: string } | null = null;
      if (active?.role === 'MEMBER') {
        memberScope = { membershipId: active.membershipId };
      } else if (!active && participant.providerId) {
        const provider = await this.prisma.provider.findUnique({
          where: { id: participant.providerId },
          select: { workspaceId: true },
        });
        const membership = provider
          ? await this.prisma.workspaceMembership.findUnique({
              where: {
                workspaceId_userId: { workspaceId: provider.workspaceId, userId },
              },
              select: { id: true, role: true, status: true },
            })
          : null;
        if (membership?.status === 'ACTIVE' && membership.role === 'MEMBER') {
          memberScope = { membershipId: membership.id };
        }
      }
      if (memberScope) {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { serviceRequest: { select: { assignedMembershipId: true } } },
        });
        if (conversation?.serviceRequest?.assignedMembershipId !== memberScope.membershipId) {
          throw new ForbiddenException('This conversation is not assigned to you');
        }
      }
    }
    return participant;
  }

  async otherParticipantUserIds(conversationId: string, excludeUserId: string): Promise<string[]> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: { client: { select: { userId: true } }, provider: { select: { userId: true } } },
    });
    return participants
      .map((p: (typeof participants)[number]) => p.client?.userId ?? p.provider?.userId)
      .filter((id: string | undefined): id is string => !!id && id !== excludeUserId);
  }
}
