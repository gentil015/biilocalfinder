import {
  findPublicContactDetail,
  normalizeBusinessName,
  normalizeIdentity,
} from './provider-fraud-signals';

describe('provider fraud signals', () => {
  it('normalizes identity values for comparisons', () => {
    expect(normalizeIdentity('REG-001 / 2026')).toBe('reg0012026');
    expect(normalizeBusinessName('Bright Spark Cleaning Ltd')).toBe('brightsparkcleaning');
    expect(normalizeBusinessName('Bright Spark Cleaning Limited')).toBe('brightsparkcleaning');
  });

  it('finds direct contact details in public text', () => {
    expect(findPublicContactDetail(['Email hello@example.com'])).toBe('email');
    expect(findPublicContactDetail(['Visit https://example.com/book'])).toBe('url');
    expect(findPublicContactDetail(['Call +250 788 123 456'])).toBe('phone');
  });

  it('does not treat ordinary prices or dates as phone numbers', () => {
    expect(findPublicContactDetail(['RWF 50000 for 2 rooms'])).toBeNull();
    expect(findPublicContactDetail(['Available on 2026-11-09'])).toBeNull();
  });
});
