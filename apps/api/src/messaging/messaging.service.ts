import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StartConversationDto } from './dto/start-conversation.dto';

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
  ) {}

  // Single conversation per (client, provider) pair. A client who already has
  // a thread with a provider — including one created by posting a service
  // request — must land back in it rather than starting a duplicate, so
  // this reuses the existing conversation and just appends the new message.
  async startConversation(userId: string, dto: StartConversationDto) {
    const [clientProfile, user] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
    ]);
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

    if (dto.body) {
      const senderName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'A client';
      await this.notifications.notify({
        userId: provider.userId,
        type: 'NEW_MESSAGE',
        title: 'New message',
        body: `${senderName}: ${dto.body.trim().slice(0, 140)}`,
        data: { conversationId },
      });
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

    return this.prisma.conversation.findMany({
      where: {
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
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
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

  async sendMessage(conversationId: string, senderId: string, body: string) {
    await this.assertParticipant(conversationId, senderId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId, body },
        include: MESSAGE_INCLUDE,
      }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);

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
