import { VerificationDocumentType, VerificationType } from '@prisma/client';

export const VERIFICATION_QUEUE = 'verification';

// How long an approval lasts unless the admin picks something else.
export const DEFAULT_VALIDITY_MONTHS = 12;
export const MAX_VALIDITY_MONTHS = 36;
// Providers get a heads-up this many days before a badge lapses.
export const EXPIRY_REMINDER_DAYS = 30;
// A renewal can be submitted this many days before expiry.
export const RENEWAL_WINDOW_DAYS = 30;

export const MAX_DOCUMENTS_PER_SUBMISSION = 5;
export const VERIFICATION_DOC_PREFIX = 'verification-docs';
export const SIGNED_URL_TTL_SECONDS = 300;

// Document types accepted for each kind of verification…
export const ACCEPTED_DOCUMENTS: Record<VerificationType, VerificationDocumentType[]> = {
  IDENTITY: ['NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENSE'],
  BUSINESS: ['BUSINESS_REGISTRATION', 'TAX_CERTIFICATE'],
  SERVICE: ['PROFESSIONAL_LICENSE', 'CERTIFICATE', 'OTHER'],
};

// …and the ones of which a submission must include at least one.
export const REQUIRED_ANY_OF: Record<VerificationType, VerificationDocumentType[]> = {
  IDENTITY: ['NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENSE'],
  BUSINESS: ['BUSINESS_REGISTRATION'],
  SERVICE: ['PROFESSIONAL_LICENSE', 'CERTIFICATE'],
};

// Only these two types decide the provider-level badge. SERVICE records
// badge a single offering and never suspend or un-verify the provider.
export const PROVIDER_LEVEL_TYPES: VerificationType[] = ['IDENTITY', 'BUSINESS'];

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
