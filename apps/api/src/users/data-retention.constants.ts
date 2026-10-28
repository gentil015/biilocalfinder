export const DATA_RETENTION_QUEUE = 'data-retention';

function days(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RETENTION = {
  // Short-lived secrets: expired/used auth artifacts have no value once dead.
  authArtifactDays: days(process.env.RETENTION_AUTH_ARTIFACT_DAYS, 30),
  // Read notifications are product noise, not records the user needs forever.
  readNotificationDays: days(process.env.RETENTION_READ_NOTIFICATION_DAYS, 180),
  // Derived personalization signal should not become a permanent shadow profile.
  interactionDays: days(process.env.RETENTION_INTERACTION_DAYS, 365),
  // Verification evidence is needed for a decision and audit window, then
  // the identity documents themselves should be gone.
  verificationDocumentDays: days(process.env.RETENTION_VERIFICATION_DOCUMENT_DAYS, 180),
  // Dispute evidence follows the same rule once the dispute is closed.
  disputeEvidenceDays: days(process.env.RETENTION_DISPUTE_EVIDENCE_DAYS, 365),
  // ID/registration numbers on closed applications are no longer needed for
  // the marketplace relationship.
  applicationPiiDays: days(process.env.RETENTION_APPLICATION_PII_DAYS, 180),
};
