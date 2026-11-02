import { BadRequestException } from '@nestjs/common';
import { CustomerAssistService } from './customer-assist.service';
import {
  CustomerAssistInput,
  CustomerAssistOutput,
  CustomerAssistProvider,
} from './customer-assist.interface';

const SERVICES = [
  {
    id: 'svc-plumbing',
    name: 'Leak detection and pipe repair',
    slug: 'leak-detection-and-pipe-repair',
    category: { id: 'cat-plumbing', slug: 'plumbing', name: 'Plumbing' },
  },
];

const PLUMBING_KEY = 'plumbing/leak-detection-and-pipe-repair';
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function fakeProvider(output: CustomerAssistOutput): { suggest: jest.Mock } {
  return { suggest: jest.fn().mockResolvedValue(output) };
}

function makePrisma() {
  return {
    clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    workspaceMembership: { findMany: jest.fn().mockResolvedValue([]) },
    serviceOffering: { findMany: jest.fn().mockResolvedValue([]) },
    serviceRequest: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    quote: { findMany: jest.fn().mockResolvedValue([]) },
    availability: { findMany: jest.fn().mockResolvedValue([]) },
    availabilityException: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeService(provider: CustomerAssistProvider, prisma = makePrisma()) {
  const servicesService = { findAll: jest.fn().mockResolvedValue(SERVICES) };
  return {
    service: new CustomerAssistService(servicesService as any, prisma as any, provider),
    prisma,
  };
}

function clientContext(prisma: ReturnType<typeof makePrisma>) {
  prisma.clientProfile.findUnique.mockResolvedValue({ id: 'client-1', userId: 'user-1' });
  prisma.serviceRequest.findMany.mockResolvedValue([
    {
      id: 'req-1',
      title: 'Leaking sink',
      status: 'OPEN',
      service: { name: 'Leak detection and pipe repair' },
      _count: { quotes: 2 },
      createdAt: new Date(),
    },
  ]);
  prisma.booking.findMany.mockResolvedValue([
    {
      id: 'book-1',
      status: 'CONFIRMED',
      scheduledAt: new Date(),
      provider: { businessName: 'Acme Plumbing' },
      serviceRequest: { service: { name: 'Leak detection and pipe repair' } },
    },
  ]);
  prisma.quote.findMany.mockResolvedValue([]);
}

function providerContext(prisma: ReturnType<typeof makePrisma>, overrides: { status?: string } = {}) {
  prisma.workspaceMembership.findMany.mockResolvedValue([
    {
      id: 'mem-1',
      workspaceId: 'ws-1',
      role: 'OWNER',
      workspace: {
        provider: {
          id: 'prov-1',
          businessName: 'Acme Plumbing',
          description: 'We fix pipes',
          logoUrl: null,
          verificationStatus: 'VERIFIED',
          availabilityStatus: 'UNAVAILABLE',
          rating: 4.8,
          reviewCount: 12,
          onboardingCompletedAt: new Date(),
          location: { city: 'Kigali' },
        },
      },
    },
  ]);
  prisma.serviceOffering.findMany.mockResolvedValue([
    {
      id: 'off-1',
      serviceId: 'svc-plumbing',
      title: 'Emergency leak repair',
      basePrice: 25000,
      isActive: true,
      service: { name: 'Leak detection and pipe repair' },
      createdAt: new Date(),
    },
  ]);
  prisma.serviceRequest.findMany.mockResolvedValue([
    {
      id: 'req-9',
      title: 'Burst pipe',
      status: overrides.status ?? 'OPEN',
      providerId: null,
      isPublic: false,
      serviceId: 'svc-plumbing',
      budgetMin: null,
      budgetMax: null,
      preferredDate: null,
      service: { name: 'Leak detection and pipe repair' },
      _count: { quotes: 0 },
    },
  ]);
}

describe('CustomerAssistService', () => {
  it('rejects an empty message before calling the model', async () => {
    const provider = fakeProvider({});
    const { service } = makeService(provider);

    await expect(service.chat({ consentToProcess: true, message: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('treats an anonymous caller as a guest and never exposes account actions', async () => {
    const provider = fakeProvider({
      actions: [
        { kind: 'prefill-request', serviceKey: PLUMBING_KEY },
        { kind: 'send-quote', requestRef: 'pr1', price: 1000 },
        { kind: 'open-booking', bookingRef: 'cb1' },
      ],
    });
    const { service } = makeService(provider);

    const result = await service.chat({ consentToProcess: true, message: 'Find a plumber' });

    expect(result.role).toBe('GUEST');
    expect(result.actions).toEqual([]);
    expect(provider.suggest).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'GUEST', context: undefined }),
    );
  });

  it('builds a pre-filled request link for a client and sanitizes every field', async () => {
    const prisma = makePrisma();
    clientContext(prisma);
    const provider = fakeProvider({
      actions: [
        {
          kind: 'prefill-request',
          serviceKey: PLUMBING_KEY,
          title: 'Fix <sink>',
          description: 'Pipe under the sink',
          preferredDate: tomorrow,
          preferredTime: '10:30',
          budgetMin: 20000,
          budgetMax: 50000,
          additionalNotes: 'Bring tools',
        },
      ],
    });
    const { service } = makeService(provider, prisma);

    const result = await service.chat(
      { consentToProcess: true, message: 'Post a plumbing request' },
      { id: 'user-1', role: 'CLIENT' },
    );

    expect(result.role).toBe('CLIENT');
    const action = result.actions.find((a) => a.kind === 'prefill-request');
    expect(action).toBeDefined();
    const url = new URL(action!.href!, 'https://example.test');
    expect(url.pathname).toBe('/requests/new');
    expect(url.searchParams.get('serviceId')).toBe('svc-plumbing');
    expect(url.searchParams.get('title')).toBe('Fix <sink>');
    expect(url.searchParams.get('preferredDate')).toBe(tomorrow);
    expect(url.searchParams.get('budgetMin')).toBe('20000');
    expect(action!.requiresConfirmation).not.toBe(true);
  });

  it('only opens records the caller actually owns', async () => {
    const prisma = makePrisma();
    clientContext(prisma);
    const provider = fakeProvider({
      actions: [
        { kind: 'open-request', requestRef: 'cr1' },
        { kind: 'open-request', requestRef: 'cr9' },
        { kind: 'open-booking', bookingRef: 'cb1' },
        { kind: 'open-booking', bookingRef: 'cb9' },
      ],
    });
    const { service } = makeService(provider, prisma);

    const result = await service.chat(
      { consentToProcess: true, message: 'My requests' },
      { id: 'user-1', role: 'CLIENT' },
    );

    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs).toEqual(['/requests/req-1', '/bookings/book-1']);
  });

  it('proposes a provider quote and availability change as confirmed writes', async () => {
    const prisma = makePrisma();
    providerContext(prisma);
    const provider = fakeProvider({
      actions: [
        {
          kind: 'send-quote',
          requestRef: 'pr1',
          price: 50000,
          estimatedDuration: '2 hours',
          description: 'Parts included',
        },
        { kind: 'toggle-availability', status: 'AVAILABLE' },
      ],
    });
    const { service } = makeService(provider, prisma);

    const result = await service.chat(
      { consentToProcess: true, message: 'Quote the burst pipe and go available' },
      { id: 'user-1', role: 'PROVIDER' },
      'ws-1',
    );

    expect(result.role).toBe('PROVIDER');
    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: 'send-quote',
        requiresConfirmation: true,
        payload: {
          requestId: 'req-9',
          price: 50000,
          estimatedDuration: '2 hours',
          description: 'Parts included',
        },
      }),
      expect.objectContaining({
        kind: 'toggle-availability',
        requiresConfirmation: true,
        payload: { status: 'AVAILABLE' },
      }),
    ]);
  });

  it('drops a quote for an unknown request, a negative price, or a request no longer accepting quotes', async () => {
    const prisma = makePrisma();
    providerContext(prisma, { status: 'BOOKED' });
    const provider = fakeProvider({
      actions: [
        { kind: 'send-quote', requestRef: 'pr9', price: 1000 },
        { kind: 'send-quote', requestRef: 'pr1', price: -5 },
        { kind: 'send-quote', requestRef: 'pr1', price: 1000 },
        { kind: 'toggle-availability', status: 'BUSY' },
      ],
    });
    const { service } = makeService(provider, prisma);

    const result = await service.chat(
      { consentToProcess: true, message: 'Quote it' },
      { id: 'user-1', role: 'PROVIDER' },
      'ws-1',
    );

    expect(result.actions).toEqual([]);
  });

  it('does not guess a provider workspace when none was selected', async () => {
    const prisma = makePrisma();
    providerContext(prisma);
    const first = (await prisma.workspaceMembership.findMany()) as unknown[];
    prisma.workspaceMembership.findMany.mockResolvedValue([
      ...first,
      {
        id: 'mem-2',
        workspaceId: 'ws-2',
        role: 'OWNER',
        workspace: { provider: { id: 'prov-2' } },
      },
    ]);
    const provider = fakeProvider({
      actions: [{ kind: 'send-quote', requestRef: 'pr1', price: 1000 }],
    });
    const { service } = makeService(provider, prisma);

    const result = await service.chat(
      { consentToProcess: true, message: 'Quote it' },
      { id: 'user-1', role: 'PROVIDER' },
    );

    expect(result.actions).toEqual([]);
    expect(provider.suggest).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'PROVIDER', context: undefined }),
    );
  });

  it('passes only the caller-owned snapshot to the model', async () => {
    const prisma = makePrisma();
    clientContext(prisma);
    const provider = fakeProvider({});
    const { service } = makeService(provider, prisma);

    await service.chat(
      { consentToProcess: true, message: 'What are my requests?' },
      { id: 'user-1', role: 'CLIENT' },
    );

    const input = provider.suggest.mock.calls[0][0] as CustomerAssistInput;
    expect(input.context?.client?.requests).toEqual([
      expect.objectContaining({ ref: 'cr1', title: 'Leaking sink', quoteCount: 2 }),
    ]);
    expect(input.context?.provider).toBeUndefined();
  });
});
