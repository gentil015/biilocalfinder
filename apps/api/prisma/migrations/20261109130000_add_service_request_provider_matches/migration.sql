CREATE TABLE "service_request_provider_matches" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "matchType" TEXT NOT NULL,
    "reasons" JSONB,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_provider_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_request_provider_matches_serviceRequestId_providerId_key"
    ON "service_request_provider_matches"("serviceRequestId", "providerId");
CREATE INDEX "service_request_provider_matches_serviceRequestId_score_idx"
    ON "service_request_provider_matches"("serviceRequestId", "score");
CREATE INDEX "service_request_provider_matches_providerId_createdAt_idx"
    ON "service_request_provider_matches"("providerId", "createdAt");

ALTER TABLE "service_request_provider_matches"
    ADD CONSTRAINT "service_request_provider_matches_serviceRequestId_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_request_provider_matches"
    ADD CONSTRAINT "service_request_provider_matches_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "providers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
