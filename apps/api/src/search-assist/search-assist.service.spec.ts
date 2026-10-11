import { BadRequestException } from '@nestjs/common';
import { CategoryAttribute } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { SearchAssistService } from './search-assist.service';
import { SearchAssistOutput, SearchAssistProvider } from './search-assist.interface';

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

function fakeProvider(output: SearchAssistOutput): { parse: jest.Mock } {
  return { parse: jest.fn().mockResolvedValue(output) };
}

function makeService(provider: SearchAssistProvider, attributes: CategoryAttribute[] = [attr()]) {
  const servicesService = { findAll: jest.fn().mockResolvedValue(SERVICES) };
  const categoriesService = new CategoriesService({} as any);
  jest
    .spyOn(categoriesService, 'getAttributesForCategory')
    .mockImplementation(async (categoryId: string) =>
      categoryId === 'cat-plumbing' ? (attributes as any) : [],
    );
  return new SearchAssistService(servicesService as any, categoriesService, provider);
}

describe('SearchAssistService.parse', () => {
  it('rejects an empty message before ever calling the model', async () => {
    const provider = fakeProvider({});
    const service = makeService(provider);

    await expect(service.parse({ message: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.parse).not.toHaveBeenCalled();
  });

  it('hands the model only reversible catalog keys, never row ids', async () => {
    const provider = fakeProvider({});
    const service = makeService(provider);

    await service.parse({ message: 'need a plumber' });

    const input = provider.parse.mock.calls[0][0];
    expect(input.services).toEqual([
      { key: 'plumbing/leak-detection-and-pipe-repair', name: 'Leak detection and pipe repair' },
      { key: 'cleaning/deep-cleaning-for-homes-and-offices', name: 'Deep cleaning for homes and offices' },
    ]);
    // Only filterable attributes reach the model (the search engine rejects
    // non-filterable slugs outright).
    expect(input.attributes).toEqual([
      expect.objectContaining({ categoryKey: 'plumbing', slug: 'urgency', type: 'SELECT' }),
    ]);
  });

  it('turns a full valid output into search filters plus matching chips', async () => {
    const service = makeService(
      fakeProvider({
        serviceKey: PLUMBING_KEY,
        serviceName: 'Plumber',
        city: 'Kigali',
        urgency: 'urgent',
        budgetMin: 30000,
        budgetMax: 60000,
        minExperience: 3,
        minRating: 4,
        verifiedOnly: true,
        keywords: ['cctv', 'security'],
        reply: 'Got it.',
      }),
    );

    const result = await service.parse({ message: 'anything' });

    expect(result.filters).toMatchObject({
      serviceId: 'svc-plumbing',
      categoryId: 'cat-plumbing',
      // Kigali coordinates come from the fixed places table, not a geocoder.
      lat: expect.any(Number),
      lng: expect.any(Number),
      radiusKm: 30,
      availableNow: true,
      minPrice: 30000,
      maxPrice: 60000,
      minExperience: 3,
      minRating: 4,
      verifiedOnly: true,
      q: 'cctv security',
      sort: 'recommended',
    });
    expect(result.chips.map((c) => c.key)).toEqual([
      'service',
      'location',
      'urgency',
      'budget',
      'experience',
      'rating',
      'verified',
    ]);
    expect(result.suggestedCount).toBe(7);
    expect(result.skippedCount).toBe(0);
    expect(result.reply).toBe('Got it.');
  });

  it('never resolves a service key that is not in the catalog', async () => {
    const service = makeService(fakeProvider({ serviceKey: 'plumbing/made-up-service', serviceName: 'Plumber' }));

    const result = await service.parse({ message: 'anything' });

    expect(result.filters.serviceId).toBeUndefined();
    expect(result.filters.categoryId).toBeUndefined();
    expect(result.skippedCount).toBe(1);
    // The human-readable label still surfaces — it filters nothing but the
    // client can see what was understood.
    expect(result.chips).toContainEqual({ key: 'service', value: 'Plumber' });
  });

  it('keeps a serviceName without a serviceKey and does not count it as skipped', async () => {
    const service = makeService(fakeProvider({ serviceName: 'CCTV installation' }));

    const result = await service.parse({ message: 'install cctv' });

    expect(result.filters.serviceId).toBeUndefined();
    expect(result.skippedCount).toBe(0);
    expect(result.chips[0]).toEqual({ key: 'service', value: 'CCTV installation' });
  });

  it('drops an inverted budget pair rather than guessing which end is wrong', async () => {
    const service = makeService(fakeProvider({ budgetMin: 60000, budgetMax: 30000 }));

    const result = await service.parse({ message: 'x' });

    expect(result.filters.minPrice).toBeUndefined();
    expect(result.filters.maxPrice).toBeUndefined();
    expect(result.skippedCount).toBe(2);
  });

  it('treats model nulls as omitted, not as invalid values', async () => {
    const service = makeService(
      fakeProvider({ budgetMin: null, budgetMax: null, minExperience: null, minRating: null, verifiedOnly: null } as any),
    );

    const result = await service.parse({ message: 'x' });

    expect(result.skippedCount).toBe(0);
    expect(result.chips.every((c) => c.key !== 'budget')).toBe(true);
  });

  it('drops out-of-range budgets, ratings and experience instead of clamping', async () => {
    const service = makeService(
      fakeProvider({ budgetMin: -1, minRating: 7, minExperience: 400 }),
    );

    const result = await service.parse({ message: 'x' });

    expect(result.filters.minPrice).toBeUndefined();
    expect(result.filters.minRating).toBeUndefined();
    expect(result.filters.minExperience).toBeUndefined();
    expect(result.skippedCount).toBe(3);
  });

  it('maps only urgency to availableNow and keeps normal searches unfiltered', async () => {
    const urgent = await makeService(fakeProvider({ urgency: 'urgent' })).parse({ message: 'x' });
    expect(urgent.filters.availableNow).toBe(true);

    const normal = await makeService(fakeProvider({ urgency: 'normal' })).parse({ message: 'x' });
    expect(normal.filters.availableNow).toBeUndefined();
    // The chip is always shown so the client sees the criterion either way.
    expect(normal.chips).toContainEqual({ key: 'urgency', value: 'normal' });
  });

  it('lets a named city win over the searcher\'s own coordinates', async () => {
    const service = makeService(fakeProvider({ city: 'Huye' }));

    const result = await service.parse({ message: 'x', lat: -1.5, lng: 29.9, radiusKm: 5 });

    expect(result.filters.lat).not.toBe(-1.5);
    expect(result.filters.lng).not.toBe(29.9);
    expect(result.chips).toContainEqual({ key: 'location', value: expect.stringContaining('Huye') });
  });

  it('falls back to the searcher\'s coordinates only when no city was named', async () => {
    const service = makeService(fakeProvider({}));

    const result = await service.parse({ message: 'x', lat: -1.5, lng: 29.9, radiusKm: 5 });

    expect(result.filters).toMatchObject({ lat: -1.5, lng: 29.9, radiusKm: 5 });
  });

  it('ignores an unresolvable city but still searches near the user', async () => {
    const service = makeService(fakeProvider({ city: 'Nowhereville' }));

    const result = await service.parse({ message: 'x', lat: -1.5, lng: 29.9 });

    expect(result.filters.lat).toBe(-1.5);
    expect(result.chips.some((c) => c.key === 'location')).toBe(false);
    expect(result.skippedCount).toBe(1);
  });

  it('sanitizes keywords: lowercased, deduplicated, city removed, capped at five', async () => {
    const service = makeService(
      fakeProvider({ keywords: ['CCTV', 'Security', 'Cctv', 'Kigali', 'one', 'two', 'three', 'four', 'five', 'six'] }),
    );

    const result = await service.parse({ message: 'x' });

    expect(result.filters.q).toBe('cctv security one two three');
  });

  it('rejects attribute values that fail re-validation, keeping only legal ones', async () => {
    const service = makeService(fakeProvider({ serviceKey: PLUMBING_KEY, values: { urgency: 'High', 'not-a-field': 1 } }));

    const result = await service.parse({ message: 'urgent' });

    expect(result.attributes).toEqual({ urgency: 'High' });
    expect(result.skippedCount).toBe(1);
    expect(result.chips).toContainEqual({ key: 'attribute', name: 'Urgency', value: 'High' });
  });

  it('drops an option that is not on the allowed list', async () => {
    const service = makeService(fakeProvider({ serviceKey: PLUMBING_KEY, values: { urgency: 'Extremely High' } }));

    const result = await service.parse({ message: 'urgent' });

    expect(result.attributes).toBeUndefined();
    expect(result.skippedCount).toBe(1);
  });

  it('drops attribute values when no service is known — they cannot belong to a category', async () => {
    const service = makeService(fakeProvider({ values: { urgency: 'High' } }));

    const result = await service.parse({ message: 'urgent' });

    expect(result.attributes).toBeUndefined();
    expect(result.skippedCount).toBe(1);
    expect(result.chips.some((c) => c.key === 'attribute')).toBe(false);
  });

  it('for a MULTI_SELECT keeps only what the single-value filter can express, chip included', async () => {
    const multi = attr({
      id: 'attr-2',
      slug: 'equipment',
      name: 'Equipment',
      type: 'MULTI_SELECT',
      options: ['Sound System', 'Lighting', 'Mixer'],
    });
    const service = makeService(fakeProvider({ serviceKey: PLUMBING_KEY, values: { equipment: ['Sound System', 'Lighting'] } }), [
      multi,
    ]);

    const result = await service.parse({ message: 'dj with sound and light' });

    // attributes[slug] holds exactly one value (containment match), and the
    // chip shows the same — never a promise the search cannot keep.
    expect(result.attributes).toEqual({ equipment: 'Sound System' });
    expect(result.chips).toContainEqual({ key: 'attribute', name: 'Equipment', value: 'Sound System' });
    // The dropped option is counted, not silently swallowed.
    expect(result.skippedCount).toBe(1);
  });

  it('uses the default language reply only when the model gave none, and caps a runaway reply', async () => {
    const noReply = await makeService(fakeProvider({})).parse({ message: 'x' });
    expect(noReply.reply).toContain('Here is what I understood');

    const rw = await makeService(fakeProvider({})).parse({ message: 'x', language: 'rw' });
    expect(rw.reply).toContain('ndabonye');

    const long = await makeService(fakeProvider({ reply: 'x'.repeat(900) })).parse({ message: 'x' });
    expect(long.reply).toHaveLength(500);
  });
});
