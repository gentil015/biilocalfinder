import { VerificationStatus, VerificationType } from '@prisma/client';

export interface RecordLike {
  type: VerificationType;
  status: VerificationStatus;
  expiresAt: Date | null;
  updatedAt: Date;
}

export interface ProviderVerificationState {
  status: VerificationStatus;
  identityVerified: boolean;
  businessVerified: boolean;
  // Earliest expiry among the live records that back the badge.
  expiresAt: Date | null;
}

export function isLive(r: Pick<RecordLike, 'status' | 'expiresAt'>, now: Date): boolean {
  return r.status === 'VERIFIED' && (!r.expiresAt || r.expiresAt.getTime() > now.getTime());
}

// The single rule that turns verification records (+ phone ownership) into
// the badge state shown on a provider. Pure, so the rules are unit-tested
// without a database and can't drift between code paths.
//
//   SUSPENDED  any identity/business record is suspended (admin decision;
//              also hides the provider from search)
//   VERIFIED   a live identity verification AND a verified phone number
//   PENDING    something awaiting admin review, or identity approved but the
//              phone isn't verified yet
//   EXPIRED / REJECTED  whichever of those happened most recently, when
//              nothing live or pending remains
//   UNVERIFIED nothing submitted
export function computeProviderVerification(
  records: RecordLike[],
  opts: { phoneVerified: boolean; now?: Date },
): ProviderVerificationState {
  const now = opts.now ?? new Date();
  const providerLevel = records.filter((r) => r.type === 'IDENTITY' || r.type === 'BUSINESS');

  const liveIdentity = providerLevel.filter((r) => r.type === 'IDENTITY' && isLive(r, now));
  const liveBusiness = providerLevel.filter((r) => r.type === 'BUSINESS' && isLive(r, now));
  const identityVerified = liveIdentity.length > 0;
  const businessVerified = liveBusiness.length > 0;

  const expiries = [...liveIdentity, ...liveBusiness]
    .map((r) => r.expiresAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  const expiresAt = expiries[0] ?? null;

  let status: VerificationStatus;
  if (providerLevel.some((r) => r.status === 'SUSPENDED')) {
    status = 'SUSPENDED';
  } else if (identityVerified && opts.phoneVerified) {
    status = 'VERIFIED';
  } else if (providerLevel.some((r) => r.status === 'PENDING') || identityVerified) {
    status = 'PENDING';
  } else {
    const lapsed = providerLevel
      .filter((r) => r.status === 'EXPIRED' || r.status === 'REJECTED')
      // a VERIFIED record past its expiry that the sweeper hasn't caught yet
      .concat(
        providerLevel.filter((r) => r.status === 'VERIFIED' && !isLive(r, now)).map((r) => ({ ...r, status: 'EXPIRED' as const })),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    status = lapsed[0]?.status ?? 'UNVERIFIED';
  }

  return { status, identityVerified, businessVerified, expiresAt };
}

// What a record may move to. REJECTED and EXPIRED are terminal — a provider
// resubmits instead of reviving an old record, which keeps history honest.
const ALLOWED: Record<VerificationStatus, VerificationStatus[]> = {
  UNVERIFIED: [],
  PENDING: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED', 'EXPIRED'],
  SUSPENDED: ['VERIFIED', 'EXPIRED'],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED[from].includes(to);
}
