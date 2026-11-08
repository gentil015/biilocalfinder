import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

describe('MessagingService.startConversation', () => {
  let service: MessagingService;
  let prisma: any;
  let providerContext: any;
  let notifications: any;

  const clientUserId = 'client-user-1';
  const clientProfileId = 'client-1';

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      clientProfile: { findUnique: jest.fn() },
      provider: { findUnique: jest.fn() },
      conversation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      workspaceMembership: { findUnique: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    providerContext = { getProviderIdsForUser: jest.fn() };
    notifications = { notify: jest.fn() };
    service = new MessagingService(prisma, providerContext, notifications);
    providerContext.getProviderIdsForUser.mockResolvedValue([]);
  });

  /** Both participants on the created thread, as nested `create` would be. */
  function creationParticipants() {
    return [
      { clientId: clientProfileId },
      { providerId: 'provider-1' },
    ];
  }

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Aline', lastName: 'Mukamana' });
    prisma.clientProfile.findUnique.mockResolvedValue({ id: clientProfileId, userId: clientUserId });
    prisma.provider.findUnique.mockResolvedValue({
      id: 'provider-1',
      userId: 'provider-user-1',
      businessName: 'BassCulture DJ',
    });
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: 'conv-new' });
    prisma.conversation.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, participants: [] }),
    );
    prisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'part-1', clientId: clientProfileId });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      { client: { userId: clientUserId }, provider: null },
      { client: null, provider: { userId: 'provider-user-1' } },
    ]);
    prisma.message.create.mockResolvedValue({
      id: 'msg-1',
      body: 'Hi',
      conversationId: 'conv-new',
      sender: { firstName: 'Aline', lastName: 'Mukamana' },
    });
    prisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
  });

  it('creates a conversation with no service request attached', async () => {
    const result = await service.startConversation(clientUserId, { providerId: 'provider-1' });

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { participants: { create: creationParticipants() } },
      }),
    );
    // The whole point: a direct enquiry must not invent a request.
    expect(prisma.conversation.create.mock.calls[0][0].data.serviceRequestId).toBeUndefined();
    expect(result.created).toBe(true);
  });

  it('requires both a client participant and that specific provider on the thread', async () => {
    await service.startConversation(clientUserId, { providerId: 'provider-1' });

    const where = prisma.conversation.findFirst.mock.calls[0][0].where;
    expect(where.AND).toEqual([
      { participants: { some: { clientId: clientProfileId } } },
      { participants: { some: { providerId: 'provider-1' } } },
    ]);
  });

  it('posts the opening message and notifies the provider', async () => {
    const result = await service.startConversation(clientUserId, {
      providerId: 'provider-1',
      body: 'Do you do weddings?',
    });

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversationId: 'conv-new', senderId: clientUserId }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'provider-user-1', type: 'NEW_MESSAGE' }),
    );
    expect(result.message).toEqual({
      id: 'msg-1',
      body: 'Hi',
      conversationId: 'conv-new',
      sender: { firstName: 'Aline', lastName: 'Mukamana' },
    });
  });

  it('trims the opening message so whitespace-only text cannot be stored', async () => {
    await service.startConversation(clientUserId, { providerId: 'provider-1', body: '  hello  ' });

    expect(prisma.message.create.mock.calls[0][0].data.body).toBe('hello');
  });

  it('notifies the other participant on every reply, not just the opening message', async () => {
    await service.sendMessage('conv-existing', clientUserId, 'Any update?');

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user-1',
        type: 'NEW_MESSAGE',
        body: 'Aline Mukamana: Any update?',
        data: { conversationId: 'conv-existing' },
      }),
    );
    expect(notifications.notify).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: clientUserId }),
    );
  });

  it('reuses the existing thread instead of creating a duplicate', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-existing' });

    const result = await service.startConversation(clientUserId, { providerId: 'provider-1' });

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.id).toBe('conv-existing');
  });

  it('does not notify when no opening message was supplied', async () => {
    await service.startConversation(clientUserId, { providerId: 'provider-1' });

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('refuses provider accounts', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue(null);

    await expect(service.startConversation('provider-user-1', { providerId: 'provider-2' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an unknown provider', async () => {
    prisma.provider.findUnique.mockResolvedValue(null);

    await expect(service.startConversation(clientUserId, { providerId: 'nope' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a client messaging their own provider account', async () => {
    prisma.provider.findUnique.mockResolvedValue({
      id: 'provider-1',
      userId: clientUserId,
      businessName: 'My Own Studio',
    });

    await expect(service.startConversation(clientUserId, { providerId: 'provider-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});
describe('MessagingService.assertParticipant without a workspace context', () => {
  let service: MessagingService;
  let prisma: any;
  let providerContext: any;

  beforeEach(() => {
    prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      provider: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }) },
      conversationParticipant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'part-2', providerId: 'provider-1' }),
      },
      conversation: { findUnique: jest.fn() },
      workspaceMembership: { findUnique: jest.fn() },
    };
    providerContext = { getProviderIdsForUser: jest.fn().mockResolvedValue(['provider-1']) };
    // Socket path: no WorkspaceContextService, like the gateway.
    service = new MessagingService(prisma, providerContext, { notify: jest.fn() } as any);
  });

  it('rejects an unassigned conversation for a MEMBER', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'mem-1', role: 'MEMBER', status: 'ACTIVE' });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      serviceRequest: { assignedMembershipId: 'mem-2' },
    });

    await expect(service.assertParticipant('conv-1', 'provider-user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a conversation assigned to that MEMBER', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'mem-1', role: 'MEMBER', status: 'ACTIVE' });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      serviceRequest: { assignedMembershipId: 'mem-1' },
    });

    await expect(service.assertParticipant('conv-1', 'provider-user-1')).resolves.toEqual(
      expect.objectContaining({ id: 'part-2' }),
    );
  });

  it('does not restrict an OWNER', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'mem-1', role: 'OWNER', status: 'ACTIVE' });

    await expect(service.assertParticipant('conv-1', 'provider-user-1')).resolves.toEqual(
      expect.objectContaining({ id: 'part-2' }),
    );
    expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
  });
});

describe('MessagingService attachments', () => {
  let service: MessagingService;
  let prisma: any;
  let providerContext: any;
  let notifications: any;
  let storage: any;

  const userId = 'client-user-1';
  const conversationId = 'conv-1';
  const prefix = `message-attachments/${conversationId}/${userId}/`;

  beforeEach(() => {
    prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'client-1', userId }) },
      provider: { findUnique: jest.fn() },
      conversationParticipant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'part-1', clientId: 'client-1' }),
        findMany: jest.fn().mockResolvedValue([
          { client: { userId }, provider: null },
          { client: null, provider: { userId: 'provider-user-1' } },
        ]),
        update: jest.fn(),
      },
      conversation: { findUnique: jest.fn(), update: jest.fn() },
      workspaceMembership: { findUnique: jest.fn() },
      message: {
        create: jest.fn().mockResolvedValue({
          id: 'msg-1',
          sender: { firstName: 'Aline', lastName: 'Mukamana' },
        }),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    providerContext = { getProviderIdsForUser: jest.fn().mockResolvedValue([]) };
    notifications = { notify: jest.fn() };
    storage = {
      upload: jest.fn(),
      statObject: jest.fn(),
      getUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    };
    service = new MessagingService(prisma, providerContext, notifications, undefined, storage);
  });

  it('uploads an image under the conversation/sender prefix', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    storage.upload.mockResolvedValue({ key: `${prefix}photo.jpg`, url: 'https://cdn.test/photo.jpg' });

    const result = await service.uploadAttachment(conversationId, userId, {
      buffer,
      size: buffer.length,
      originalname: 'photo.jpg',
    } as any);

    expect(storage.upload).toHaveBeenCalledWith(
      buffer,
      'photo.jpg',
      'image/jpeg',
      `message-attachments/${conversationId}/${userId}`,
    );
    expect(result).toEqual({
      storageKey: `${prefix}photo.jpg`,
      url: 'https://cdn.test/photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: buffer.length,
    });
  });

  it('accepts a video upload', async () => {
    const buffer = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypmp42', 'ascii'),
      Buffer.alloc(8),
    ]);
    storage.upload.mockResolvedValue({ key: `${prefix}clip.mp4`, url: 'https://cdn.test/clip.mp4' });

    const result = await service.uploadAttachment(conversationId, userId, {
      buffer,
      size: buffer.length,
      originalname: 'clip.mp4',
    } as any);

    expect(result.mimeType).toBe('video/mp4');
  });

  it('accepts a voice note upload', async () => {
    const buffer = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(8),
    ]);
    storage.upload.mockResolvedValue({
      key: `${prefix}voice.webm`,
      url: 'https://cdn.test/voice.webm',
    });

    const result = await service.uploadAttachment(conversationId, userId, {
      buffer,
      size: buffer.length,
      originalname: 'voice.webm',
      mimetype: 'audio/webm;codecs=opus',
    } as any);

    expect(result.mimeType).toBe('audio/webm');
  });

  it('stores attachment metadata read from storage, not the client', async () => {
    const storageKey = `${prefix}photo.jpg`;
    storage.statObject.mockResolvedValue({ sizeBytes: 2048, mimeType: 'image/jpeg' });

    await service.sendMessage(conversationId, userId, '', [{ storageKey }]);

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: null,
          attachments: {
            create: [
              {
                storageKey,
                url: `https://cdn.test/${storageKey}`,
                mimeType: 'image/jpeg',
                sizeBytes: 2048,
              },
            ],
          },
        }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Aline Mukamana: Sent a photo' }),
    );
  });

  it('rejects a message with neither text nor attachments', async () => {
    await expect(service.sendMessage(conversationId, userId, '   ')).rejects.toThrow(
      'A message needs text or at least one attachment',
    );
  });

  it('rejects an attachment uploaded by someone else', async () => {
    await expect(
      service.sendMessage(conversationId, userId, '', [
        { storageKey: 'message-attachments/conv-1/someone-else/photo.jpg' },
      ]),
    ).rejects.toThrow('Invalid attachment reference');
  });
});
