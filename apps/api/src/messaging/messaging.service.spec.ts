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