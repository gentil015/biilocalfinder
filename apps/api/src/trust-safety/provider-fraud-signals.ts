export const FRAUD_SIGNAL = {
  SHARED_VERIFICATION_DOCUMENT: 'shared_verification_document',
  DUPLICATE_PROVIDER_IDENTITY: 'duplicate_provider_identity',
  DUPLICATE_BUSINESS_NAME: 'duplicate_business_name',
  PUBLIC_CONTACT_DETAILS: 'public_contact_details',
  UNVERIFIED_CONTACT_ACTIVITY: 'unverified_contact_activity',
} as const;

export type FraudSignalCode = (typeof FRAUD_SIGNAL)[keyof typeof FRAUD_SIGNAL];

export interface FraudSignal {
  code: FraudSignalCode;
  reason: string;
  evidenceReference?: string;
}

export type PublicContactKind = 'email' | 'phone' | 'url';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>]+/i;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BUSINESS_SUFFIX_PATTERN = /\b(?:ltd|limited|llc|inc|incorporated|corp|corporation|company|co)\b/g;

export function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeBusinessName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(BUSINESS_SUFFIX_PATTERN, ' ')
    .replace(/[^a-z0-9]/g, '');
}

export function isUsableIdentity(value: string | null | undefined): boolean {
  return normalizeIdentity(value).length >= 4;
}

export function findPublicContactDetail(
  values: Array<string | null | undefined>,
): PublicContactKind | null {
  const text = values.filter((value): value is string => !!value).join('\n');
  if (!text) return null;

  if (EMAIL_PATTERN.test(text)) return 'email';
  if (URL_PATTERN.test(text)) return 'url';

  for (const match of text.matchAll(PHONE_CANDIDATE_PATTERN)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) return 'phone';
  }

  return null;
}

export function intersects(left: Iterable<string>, right: Iterable<string>): boolean {
  const rightValues = new Set(right);
  for (const value of left) {
    if (rightValues.has(value)) return true;
  }
  return false;
}
