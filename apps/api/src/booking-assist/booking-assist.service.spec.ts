import { BadRequestException } from '@nestjs/common';
import { CategoryAttribute } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { BookingAssistService } from './booking-assist.service';
import { BookingAssistOutput, BookingAssistProvider } from './booking-assist.interface';

function attr(overrides: Partial<CategoryAttribute> = {}): CategoryAttribute {
  return {
    id: 'attr-1',
    categoryId: 'cat-plumbing',
    name: 'Urgency',
    slug: 'urgency',
    description: null,
    type: 'SELECT',
    isRequired: false,
    isFilterable: true,
    isSearchable: false,
    isPublic: true,
    displayOrder: 0,
    options: ['Low', 'Medium', 'High'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CategoryAttribute;
}

const SERVICES = [
  {
    id: 'svc-plumbing',
    categoryId: 'cat-plumbing',
    name: 'Leak detection and pipe repair',
    slug: 'leak-detection-and-pipe-repair',
    category: { id: 'cat-plumbing', slug: 'plumbing', name: 'Plumbing' },
  },
  {
    id: 'svc-cleaning',
    categoryId: 'cat-cleaning',
    name: 'Deep cleaning for homes and offices',
    slug: 'deep-cleaning-for-homes-and-offices',
    category: { id: 'cat-cleaning', slug: 'cleaning', name: 'Cleaning' },
  },
];

const PLUMBING_KEY = 'plumbing/leak-detection-and-pipe-repair';

function fakeProvider(output: BookingAssistOutput): { suggest: jest.Mock } {
  return { suggest: jest.fn().mockResolvedValue(output) };
}

function makeService(provider: BookingAssistProvider) {
  const servicesService = { findAll: jest.fn().mockResolvedValue(SERVICES) };
  const categoriesService = new CategoriesService({} as any);
  jest
    .spyOn(categoriesService, 'getAttributesForCategory')
    .mockResolvedValue([attr()] as any);
  return new BookingAssistService(servicesService as any, categoriesService, provider);
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

describe('BookingAssistService.suggest', () => {
  it('rejects an empty message before ever calling the model', async () => {
    const provider = fakeProvider({});
    const service = makeService(provider);

    await expect(service.suggest({ message: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('resolves a catalog service key to a real service id and returns filled fields', async () => {
    const service = makeService(
      fakeProvider({
        serviceKey: PLUMBING_KEY,
        title: 'Leaking pipe under the sink',
        description: 'The pipe under my kitchen sink has been dripping for two days.',
        preferredDate: tomorrow,
        preferredTime: '10:30',
        budgetMin: 20000,
        budgetMax: 50000,
        reply: 'Got it.',
      }),
    );

    const result = await service.suggest({ message: 'My sink pipe is leaking' });

    expect(result.fields).toMatchObject({
      serviceId: 'svc-plumbing',
      title: 'Leaking pipe under the sink',
      preferredDate: tomorrow,
      preferredTime: '10:30',
      budgetMin: 20000,
      budgetMax: 50000,
    });
    expect(result.missingFields).toEqual([]);
    expect(result.reply).toBe('Got it.');
    expect(result.skippedCount).toBe(0);
  });

  it('never resolves a service key that is not in the catalog', async () => {
    const service = makeService(fakeProvider({ serviceKey: 'plumbing/made-up-service', title: 'x', description: 'y' }));

    const result = await service.suggest({ message: 'anything' });

    expect(result.fields.serviceId).toBeUndefined();
    expect(result.missingFields).toContain('service');
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('ignores a model attempt to swap a service the form already pinned', async () => {
    const service = makeService(fakeProvider({ serviceKey: PLUMBING_KEY, title: 't', description: 'd' }));

    const result = await service.suggest({ message: 'clean my office', serviceId: 'svc-cleaning' });

    expect(result.fields.serviceId).toBeUndefined();
    // The pinned service counts as answered — the model cannot make it
    // "missing" by refusing to echo it back.
    expect(result.missingFields).toEqual([]);
  });

  it('loads the pinned service category questions, not another category', async () => {
    const categoriesService = new CategoriesService({} as any);
    const spy = jest.spyOn(categoriesService, 'getAttributesForCategory').mockResolvedValue([attr()] as any);
    const servicesService = { findAll: jest.fn().mockResolvedValue(SERVICES) };
    const service = new BookingAssistService(servicesService as any, categoriesService, fakeProvider({}));

    await service.suggest({ message: 'hello', serviceId: 'svc-cleaning' });

    expect(spy).toHaveBeenCalledWith('cat-cleaning', { publicOnly: true });
  });

  it('drops malformed and past dates instead of shifting them', async () => {
    const service = makeService(
      fakeProvider({
        preferredDate: '2026-02-31',
        title: 't',
        description: 'd',
      }),
    );
    const past = await service.suggest({ message: 'x', filledFields: ['service', 'title', 'description'] });
    expect(past.fields.preferredDate).toBeUndefined();
    expect(past.skippedCount).toBe(1);

    const service2 = makeService(fakeProvider({ preferredDate: yesterday, title: 't', description: 'd' }));
    const result2 = await service2.suggest({ message: 'x', filledFields: ['service', 'title', 'description'] });
    expect(result2.fields.preferredDate).toBeUndefined();
    expect(result2.skippedCount).toBe(1);
  });

  it('keeps a well-formed future date and 24h time', async () => {
    const service = makeService(fakeProvider({ preferredDate: tomorrow, preferredTime: '07:05' }));

    const result = await service.suggest({ message: 'x', filledFields: ['service', 'title', 'description'] });

    expect(result.fields.preferredDate).toBe(tomorrow);
    expect(result.fields.preferredTime).toBe('07:05');
  });

  it('drops an inverted budget pair rather than guessing which end is wrong', async () => {
    const service = makeService(fakeProvider({ budgetMin: 60000, budgetMax: 30000 }));

    const result = await service.suggest({ message: 'x', filledFields: ['service', 'title', 'description'] });

    expect(result.fields.budgetMin).toBeUndefined();
    expect(result.fields.budgetMax).toBeUndefined();
    expect(result.skippedCount).toBe(2);
  });

  it('drops budgets that are not non-negative numbers', async () => {
    const service = makeService(fakeProvider({ budgetMin: -5, budgetMax: 'lots' as any }));

    const result = await service.suggest({ message: 'x', filledFields: ['service', 'title', 'description'] });

    expect(result.fields.budgetMin).toBeUndefined();
    expect(result.fields.budgetMax).toBeUndefined();
  });

  it('re-validates attribute values and resolves slug to attribute id', async () => {
    const service = makeService(fakeProvider({ values: { urgency: 'High', 'not-a-field': 1 } }));

    const result = await service.suggest({
      message: 'urgent',
      serviceId: 'svc-plumbing',
      filledFields: ['title', 'description'],
    });

    expect(result.fields.attributeValues).toEqual({ 'attr-1': 'High' });
    expect(result.skippedCount).toBe(1);
  });

  it('drops an option that is not on the allowed list', async () => {
    const service = makeService(fakeProvider({ values: { urgency: 'Extremely High' } }));

    const result = await service.suggest({
      message: 'urgent',
      serviceId: 'svc-plumbing',
      filledFields: ['title', 'description'],
    });

    expect(result.fields.attributeValues).toBeUndefined();
    expect(result.skippedCount).toBe(1);
  });

  it('drops attribute values when no service is known — they cannot belong anywhere', async () => {
    const service = makeService(fakeProvider({ values: { urgency: 'High' } }));

    const result = await service.suggest({ message: 'urgent', filledFields: ['service', 'title', 'description'] });

    expect(result.fields.attributeValues).toBeUndefined();
    expect(result.skippedCount).toBe(1);
  });

  it('asks canned follow-up questions for every missing required field, in French', async () => {
    const service = makeService(fakeProvider({ language: 'fr' }));

    const result = await service.suggest({ message: "j'ai besoin d'aide" });

    expect(result.language).toBe('fr');
    expect(result.missingFields).toEqual(['service', 'title', 'description']);
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]).toContain('De quel service avez-vous besoin');
    expect(result.reply).toContain('précisions');
  });

  it('asks in Kinyarwanda when the model detected rw', async () => {
    const service = makeService(fakeProvider({ language: 'rw' }));

    const result = await service.suggest({ message: 'nshaka umuvugangi' });

    expect(result.language).toBe('rw');
    expect(result.questions[0]).toContain('Ni servisi iki ukeneye');
    expect(result.reply).toContain('Nkeneye ibindi');
  });

  it('does not ask about fields the client says are already filled', async () => {
    const service = makeService(fakeProvider({}));

    const result = await service.suggest({
      message: 'and the date?',
      serviceId: 'svc-plumbing',
      filledFields: ['service', 'title', 'description'],
    });

    expect(result.missingFields).toEqual([]);
    expect(result.questions).toEqual([]);
  });

  it('keeps model follow-up questions, appends the missing-field ones, and caps the total', async () => {
    const service = makeService(
      fakeProvider({ questions: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].filter(Boolean) }),
    );

    const result = await service.suggest({ message: 'x' });

    // 4 model questions + canned service/title/description, sliced to 6.
    expect(result.questions).toHaveLength(6);
    expect(result.questions[0]).toBe('q1');
    expect(result.questions[4]).toContain('Which service do you need');
    expect(result.questions[5]).toContain('short title helps providers');
  });

  it('ignores non-string questions instead of surfacing them', async () => {
    const service = makeService(fakeProvider({ questions: ['keep me', '', 42, null, '  '] } as any));

    const result = await service.suggest({
      message: 'x',
      filledFields: ['service', 'title', 'description'],
    });

    expect(result.questions).toEqual(['keep me']);
  });

  it('passes conversation history to the provider with the latest message last', async () => {
    const provider = fakeProvider({});
    const service = makeService(provider);

    await service.suggest({
      message: 'tomorrow then',
      history: [
        { role: 'user', text: 'I need a plumber' },
        { role: 'assistant', text: 'What day works?' },
      ],
      serviceId: 'svc-plumbing',
      filledFields: ['service'],
    });

    const input = provider.suggest.mock.calls[0][0];
    expect(input.messages).toEqual([
      { role: 'user', text: 'I need a plumber' },
      { role: 'assistant', text: 'What day works?' },
      { role: 'user', text: 'tomorrow then' },
    ]);
    expect(input.serviceLocked?.key).toBe(PLUMBING_KEY);
  });
});
