-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('USER_REGISTERED', 'PHONE_VERIFICATION_COMPLETED', 'EMAIL_VERIFICATION_COMPLETED', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'PASSWORD_CHANGED', 'PROFILE_UPDATED', 'PROVIDER_APPLICATION_SUBMITTED', 'DOCUMENT_UPLOADED', 'DOCUMENT_REPLACED', 'PROVIDER_APPROVED', 'PROVIDER_REJECTED', 'BOOKING_CREATED', 'BOOKING_CANCELLED', 'REVIEW_SUBMITTED', 'FRAUD_REPORT_SUBMITTED', 'ACCOUNT_RESTRICTED', 'ACCOUNT_RESTRICTION_LIFTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskAssessmentStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "FraudReportCategory" AS ENUM ('FAKE_PROVIDER_IDENTITY', 'SUSPICIOUS_PROVIDER_BEHAVIOR', 'MISLEADING_SERVICE_INFO', 'SUSPECTED_SCAM', 'SUSPICIOUS_BOOKING_ACTIVITY', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FraudReportStatus" AS ENUM ('PENDING', 'UNDER_INVESTIGATION', 'ADDITIONAL_INFORMATION_REQUIRED', 'RESOLVED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('VERIFICATION_REQUIRED', 'BOOKING_RESTRICTED', 'PROVIDER_VISIBILITY_RESTRICTED', 'TEMPORARY_SUSPENSION', 'PERMANENT_SUSPENSION');

-- CreateEnum
CREATE TYPE "RestrictionStatus" AS ENUM ('ACTIVE', 'LIFTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationCheckType" AS ENUM ('PHONE_VERIFIED', 'EMAIL_VERIFIED', 'IDENTITY_DOCUMENTS', 'BUSINESS_DOCUMENTS', 'IDENTITY_CONSISTENCY', 'DUPLICATE_IDENTITY', 'BUSINESS_CONSISTENCY', 'PROFESSIONAL_QUALIFICATION', 'LICENSE', 'PORTFOLIO', 'PREVIOUS_DECISIONS', 'UNRESOLVED_FRAUD_REPORTS', 'DOCUMENT_AUTHENTICITY');

-- CreateEnum
CREATE TYPE "VerificationCheckStatus" AS ENUM ('PASS', 'WARNING', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRAUD_REPORT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'FRAUD_REPORT_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_RESTRICTED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_RESTRICTION_LIFTED';
ALTER TYPE "NotificationType" ADD VALUE 'TRUST_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_ADDITIONAL_INFO_REQUIRED';

-- AlterTable
ALTER TABLE "verification_documents" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN     "scannedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "SecurityEventType" NOT NULL,
    "ipHash" TEXT,
    "deviceIdHash" TEXT,
    "metadata" JSONB,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "assessmentStatus" "RiskAssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "assessmentVersion" TEXT NOT NULL DEFAULT 'v1',
    "sourceEventId" TEXT,
    "summary" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_indicators" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "indicatorType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verification_checks" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "checkType" "VerificationCheckType" NOT NULL,
    "status" "VerificationCheckStatus" NOT NULL,
    "details" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "providerId" TEXT,
    "bookingId" TEXT,
    "category" "FraudReportCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "FraudReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_restrictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restrictionType" "RestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "status" "RestrictionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restriction_appeals" (
    "id" TEXT NOT NULL,
    "restrictionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restriction_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "windowHours" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "security_events_dedupeKey_key" ON "security_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_eventType_createdAt_idx" ON "security_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_ipHash_createdAt_idx" ON "security_events"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_deviceIdHash_createdAt_idx" ON "security_events"("deviceIdHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_sourceEventId_key" ON "risk_assessments"("sourceEventId");

-- CreateIndex
CREATE INDEX "risk_assessments_userId_createdAt_idx" ON "risk_assessments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "risk_assessments_riskLevel_assessmentStatus_idx" ON "risk_assessments"("riskLevel", "assessmentStatus");

-- CreateIndex
CREATE INDEX "risk_indicators_assessmentId_idx" ON "risk_indicators"("assessmentId");

-- CreateIndex
CREATE INDEX "risk_indicators_indicatorType_idx" ON "risk_indicators"("indicatorType");

-- CreateIndex
CREATE INDEX "provider_verification_checks_providerId_createdAt_idx" ON "provider_verification_checks"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_verification_checks_checkType_status_idx" ON "provider_verification_checks"("checkType", "status");

-- CreateIndex
CREATE INDEX "fraud_reports_reportedUserId_status_idx" ON "fraud_reports"("reportedUserId", "status");

-- CreateIndex
CREATE INDEX "fraud_reports_status_createdAt_idx" ON "fraud_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "fraud_reports_reporterId_createdAt_idx" ON "fraud_reports"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "account_restrictions_userId_status_idx" ON "account_restrictions"("userId", "status");

-- CreateIndex
CREATE INDEX "account_restrictions_status_expiresAt_idx" ON "account_restrictions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "restriction_appeals_restrictionId_status_idx" ON "restriction_appeals"("restrictionId", "status");

-- CreateIndex
CREATE INDEX "restriction_appeals_userId_createdAt_idx" ON "restriction_appeals"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fraud_rules_code_key" ON "fraud_rules"("code");

-- CreateIndex
CREATE INDEX "verification_documents_contentHash_idx" ON "verification_documents"("contentHash");

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "security_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_indicators" ADD CONSTRAINT "risk_indicators_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_checks" ADD CONSTRAINT "provider_verification_checks_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_appeals" ADD CONSTRAINT "restriction_appeals_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "account_restrictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_appeals" ADD CONSTRAINT "restriction_appeals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_appeals" ADD CONSTRAINT "restriction_appeals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

