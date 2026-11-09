CREATE TABLE "terms_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'TERMS',
    "version" TEXT NOT NULL,
    "accountRole" "UserRole" NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "terms_acceptances_userId_documentType_version_key"
    ON "terms_acceptances"("userId", "documentType", "version");
CREATE INDEX "terms_acceptances_userId_acceptedAt_idx"
    ON "terms_acceptances"("userId", "acceptedAt");

ALTER TABLE "terms_acceptances"
    ADD CONSTRAINT "terms_acceptances_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
