// Last line of defence before text leaves the platform for a third-party AI
// provider. This is deliberately conservative: it removes direct identifiers
// (email, phone, URLs, long numeric IDs) but not names, because names are
// often needed to understand the request and cannot be detected reliably.
// The product also requires explicit consent and discloses the processing.
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL = /\bhttps?:\/\/[^\s]+/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const LONG_NUMBER = /\b\d{6,}\b/g;

export function redactPII(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(URL, '[link]')
    .replace(PHONE, '[phone]')
    .replace(LONG_NUMBER, '[number]');
}
