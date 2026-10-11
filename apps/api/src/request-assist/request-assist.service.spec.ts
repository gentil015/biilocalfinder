import { CategoryAttribute } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { RequestAssistService } from './request-assist.service';
import { RequestAssistProvider, RequestAssistSuggestion } from './assist-provider.interface';

function attr(overrides: Partial<CategoryAttribute> = {}): CategoryAttribute {
  return {
    id: 'attr-1',
    categoryId: 'cat-1',
    name: 'Number of rooms',
    slug: 'number-of-rooms',
    description: null,
    type: 'NUMBER',
    isRequired: false,
    isFilterable: true,
    isSearchable: false,
    isPublic: true,
    displayOrder: 0,
    options: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CategoryAttribute;
}

function fakeProvider(suggestion: RequestAssistSuggestion): RequestAssistProvider {
  return { suggest: jest.fn().mockResolvedValue(suggestion) };
}

describe('RequestAssistService.suggest', () => {
  const roomsAttr = attr({ id: 'attr-rooms', slug: 'number-of-rooms', type: 'NUMBER' });
  const urgentAttr = attr({
    id: 'attr-urgent',
    slug: 'urgency',
    name: 'Urgency',
    type: 'SELECT',
    options: ['Low', 'Medium', 'High'],
  });

  function makeService(provider: RequestAssistProvider) {
    const categoriesService = new CategoriesService({} as any);
    const servicesService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'svc-1',
        categoryId: 'cat-1',
        name: 'House Cleaning',
        category: { id: 'cat-1', name: 'Cleaning' },
      }),
    };
    jest.spyOn(categoriesService, 'getAttributesForCategory').mockResolvedValue([roomsAttr, urgentAttr] as any);
    const storage = { statObject: jest.fn(), getUrl: jest.fn() };
    return new RequestAssistService(servicesService as any, categoriesService, storage as any, provider);
  }

  it('keeps a valid suggestion and resolves slug to attribute id', async () => {
    const service = makeService(
      fakeProvider({ title: 'Deep clean 3-bedroom house', values: { 'number-of-rooms': 3, urgency: 'High' } }),
    );
    const result = await service.suggest({ serviceId: 'svc-1', description: 'Need my 3 bedroom house cleaned asap' });

    expect(result.attributeValues).toEqual({ 'attr-rooms': 3, 'attr-urgent': 'High' });
    expect(result.skippedCount).toBe(0);
    expect(result.suggestedCount).toBe(2);
  });

  it('silently drops a value that fails validation instead of throwing', async () => {
    const service = makeService(
      fakeProvider({ values: { urgency: 'Extremely High' /* not one of the allowed options */ } }),
    );
    const result = await service.suggest({ serviceId: 'svc-1', description: 'Please help urgently' });

    expect(result.attributeValues).toEqual({});
    expect(result.skippedCount).toBe(1);
  });

  it('silently drops a suggestion for a slug that does not belong to this category', async () => {
    const service = makeService(fakeProvider({ values: { 'not-a-real-field': 'x' } }));
    const result = await service.suggest({ serviceId: 'svc-1', description: 'hello' });

    expect(result.attributeValues).toEqual({});
    expect(result.skippedCount).toBe(1);
  });
});
