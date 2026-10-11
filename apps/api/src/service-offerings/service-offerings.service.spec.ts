import { BadRequestException } from '@nestjs/common';
import { ServiceOfferingsService } from './service-offerings.service';

describe('ServiceOfferingsService.validateAttributeValues', () => {
  let service: ServiceOfferingsService;
  let categories: any;

  const droneAttr = { id: 'attr-drone', name: 'Drone Available', isRequired: false };
  const resolutionAttr = { id: 'attr-res', name: 'Camera Resolution', isRequired: true };

  beforeEach(() => {
    categories = {
      getAttributesForCategory: jest.fn().mockResolvedValue([droneAttr, resolutionAttr]),
      validateAttributeValue: jest.fn((attribute: any, raw: unknown) => ({
        textValue: typeof raw === 'string' ? raw : null,
        numberValue: null,
        booleanValue: typeof raw === 'boolean' ? raw : null,
        jsonValue: null,
      })),
    };
    service = new ServiceOfferingsService(
      {} as any,
      categories,
      { record: jest.fn() } as any,
      { enqueueReindex: jest.fn() } as any,
      { assertCanAdd: jest.fn().mockResolvedValue(undefined) } as any,
      { resolveForUser: jest.fn() } as any,
    );
  });

  it('rejects a value keyed by an attribute id that does not belong to this category', async () => {
    await expect(
      service.validateAttributeValues('cat-1', { 'some-other-category-attr-id': true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a value for a required attribute when not in partial mode', async () => {
    await expect(
      service.validateAttributeValues('cat-1', { 'attr-drone': true }), // missing required attr-res
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not require missing attributes when in partial (update) mode', async () => {
    await expect(
      service.validateAttributeValues('cat-1', { 'attr-drone': true }, { partial: true }),
    ).resolves.toBeDefined();
  });

  it('produces one normalized entry per submitted attribute', async () => {
    const result = await service.validateAttributeValues(
      'cat-1',
      { 'attr-drone': true, 'attr-res': '4K' },
      { partial: true },
    );
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.attributeId === 'attr-drone')?.attributeName).toBe('Drone Available');
  });
});
