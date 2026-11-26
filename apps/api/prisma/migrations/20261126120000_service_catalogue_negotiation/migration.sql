ALTER TABLE "service_offerings"
  ADD COLUMN IF NOT EXISTS "availabilityNote" TEXT;

CREATE TABLE IF NOT EXISTS "service_offering_images" (
  "id" TEXT NOT NULL,
  "serviceOfferingId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_offering_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_offering_images_serviceOfferingId_idx"
  ON "service_offering_images"("serviceOfferingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_offering_images_serviceOfferingId_fkey'
  ) THEN
    ALTER TABLE "service_offering_images"
      ADD CONSTRAINT "service_offering_images_serviceOfferingId_fkey"
      FOREIGN KEY ("serviceOfferingId") REFERENCES "service_offerings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "quote_revisions"
  ADD COLUMN IF NOT EXISTS "proposedDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "estimatedDuration" TEXT;
