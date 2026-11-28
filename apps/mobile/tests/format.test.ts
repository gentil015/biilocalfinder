import { DISPUTE_CATEGORIES, REPORT_CATEGORIES } from '@/src/services/api/endpoints/parity-customer';
import { formatMoney, humanize, statusLabel, truncate } from '@/src/utils/format';

describe('format utilities', () => {
  it('formats money with the default currency', () => {
    expect(formatMoney(12500)).toBe('RWF 12,500');
  });

  it('returns a friendly label for missing prices', () => {
    expect(formatMoney(null)).toBe('Price on request');
  });

  it('humanizes enum-like values', () => {
    expect(humanize('IN_PROGRESS')).toBe('In Progress');
  });

  it('uses the shared status labels', () => {
    expect(statusLabel.request('QUOTED')).toBe('Quotes received');
    expect(statusLabel.booking('IN_PROGRESS')).toBe('In progress');
  });

  it('truncates long text', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('exposes the backend dispute and report category enums', () => {
    expect(DISPUTE_CATEGORIES).toContain('SERVICE_NOT_AS_DESCRIBED');
    expect(DISPUTE_CATEGORIES).toContain('PAYMENT_DISAGREEMENT');
    expect(REPORT_CATEGORIES).toContain('FAKE_PROVIDER_IDENTITY');
    expect(REPORT_CATEGORIES).toContain('SUSPECTED_SCAM');
    expect(humanize(DISPUTE_CATEGORIES[0])).toBe('Service Not As Described');
  });
});
