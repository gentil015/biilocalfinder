-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Geography columns, kept separate from the lat/lng columns Prisma manages
-- directly. A trigger keeps them in sync so application code never has to
-- write to `geom` itself — it only ever writes latitude/longitude via Prisma.
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

CREATE OR REPLACE FUNCTION sync_geom_from_lat_lng() RETURNS trigger AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS locations_sync_geom ON "locations";
CREATE TRIGGER locations_sync_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "locations"
  FOR EACH ROW EXECUTE FUNCTION sync_geom_from_lat_lng();

DROP TRIGGER IF EXISTS service_areas_sync_geom ON "service_areas";
CREATE TRIGGER service_areas_sync_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "service_areas"
  FOR EACH ROW EXECUTE FUNCTION sync_geom_from_lat_lng();

-- Backfill existing rows (no-op on a fresh DB).
UPDATE "locations" SET latitude = latitude WHERE geom IS NULL;
UPDATE "service_areas" SET latitude = latitude WHERE geom IS NULL;

-- GiST indexes for fast radius / distance queries.
CREATE INDEX IF NOT EXISTS locations_geom_idx ON "locations" USING GIST (geom);
CREATE INDEX IF NOT EXISTS service_areas_geom_idx ON "service_areas" USING GIST (geom);
