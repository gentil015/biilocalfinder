import { BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoryAttribute } from '@prisma/client';

function attr(overrides: Partial<CategoryAttribute> = {}): CategoryAttribute {
  return {
    id: 'attr-1',
    categoryId: 'cat-1',
    name: 'Drone Available',
    slug: 'drone-available',
    description: null,
    type: 'BOOLEAN',
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

describe('CategoriesService.validateAttributeValue', () => {
  const service = new CategoriesService({} as any);

  it('accepts a valid BOOLEAN value', () => {
    const result = service.validateAttributeValue(attr({ type: 'BOOLEAN' }), true);
    expect(result.booleanValue).toBe(true);
  });

  it('rejects a non-boolean value for a BOOLEAN attribute', () => {
    expect(() => service.validateAttributeValue(attr({ type: 'BOOLEAN' }), 'yes')).toThrow(BadRequestException);
  });

  it('accepts a valid NUMBER value', () => {
    const result = service.validateAttributeValue(attr({ type: 'NUMBER', name: 'Guest Capacity' }), 300);
    expect(result.numberValue).toBe(300);
  });

  it('rejects a non-numeric value for a NUMBER attribute', () => {
    expect(() => service.validateAttributeValue(attr({ type: 'NUMBER' }), 'a lot')).toThrow(BadRequestException);
  });

  it('accepts a SELECT value that is one of the configured options', () => {
    const a = attr({ type: 'SELECT', name: 'Camera Resolution', options: ['4K', '6K', '8K'] });
    const result = service.validateAttributeValue(a, '4K');
    expect(result.textValue).toBe('4K');
  });

  it('rejects a SELECT value that is not one of the configured options', () => {
    const a = attr({ type: 'SELECT', options: ['4K', '6K', '8K'] });
    expect(() => service.validateAttributeValue(a, '12K')).toThrow(BadRequestException);
  });

  it('accepts MULTI_SELECT values that are all within the configured options', () => {
    const a = attr({ type: 'MULTI_SELECT', name: 'Photography Types', options: ['Wedding', 'Birthday', 'Corporate'] });
    const result = service.validateAttributeValue(a, ['Wedding', 'Corporate']);
    expect(result.jsonValue).toEqual(['Wedding', 'Corporate']);
  });

  it('rejects MULTI_SELECT values containing anything outside the configured options', () => {
    const a = attr({ type: 'MULTI_SELECT', options: ['Wedding', 'Birthday'] });
    expect(() => service.validateAttributeValue(a, ['Wedding', 'Bar Mitzvah'])).toThrow(BadRequestException);
  });

  it('rejects MULTI_SELECT given a non-array value', () => {
    const a = attr({ type: 'MULTI_SELECT', options: ['Wedding', 'Birthday'] });
    expect(() => service.validateAttributeValue(a, 'Wedding')).toThrow(BadRequestException);
  });

  it('throws when a required attribute has no value', () => {
    const a = attr({ type: 'TEXT', isRequired: true, name: 'Camera Brand' });
    expect(() => service.validateAttributeValue(a, undefined)).toThrow(BadRequestException);
  });

  it('allows an optional attribute to be omitted', () => {
    const a = attr({ type: 'TEXT', isRequired: false });
    const result = service.validateAttributeValue(a, undefined);
    expect(result.textValue).toBeNull();
  });

  it('rejects a negative PRICE value', () => {
    const a = attr({ type: 'PRICE', name: 'Starting Price' });
    expect(() => service.validateAttributeValue(a, -100)).toThrow(BadRequestException);
  });

  it('accepts a valid PRICE value', () => {
    const a = attr({ type: 'PRICE' });
    const result = service.validateAttributeValue(a, 150000);
    expect(result.numberValue).toBe(150000);
  });
});
