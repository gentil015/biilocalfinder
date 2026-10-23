# Deploying Bii Localfinder

Target: a single Docker-capable VPS (2 vCPU / 4GB RAM is plenty to start).
Kubernetes is explicitly not required for this MVP (spec §Deployment).

## 1. Provision the VPS

- Ubuntu 22.04+ (or similar), Docker + Docker Compose plugin installed.
- Point a DNS A record at the VPS for your domain (e.g. `app.example.com`).
- Open ports 80 and 443.

## 2. Get the code onto the server

```bash
git clone <your-repo-url> bii-localfinder
cd bii-localfinder
```

## 3. Configure production secrets

```bash
cp .env.example .env.production
```

Edit `.env.production` and set real values for at minimum:

- `DATABASE_URL` and `DIRECT_URL` (see the database options below)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — long random strings, never reused
  from `.env.example`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` (MinIO root credentials, or real S3 IAM
  keys if you point `S3_ENDPOINT` at AWS instead of the bundled MinIO)
- `CORS_ORIGIN` — your real frontend origin, e.g. `https://app.example.com`
- `NEXT_PUBLIC_API_URL` — the frontend/API origin, e.g.
  `https://app.example.com` (without `/api`; the frontend adds that path).
  This is embedded in the frontend during the Docker image build.
- `MAP_PROVIDER_KEY` — a real Mapbox token, once you're ready; the app
  runs fine without one (falls back to the offline mock provider)
- `SENTRY_DSN` — optional; leave blank to skip error reporting
- `SUBSCRIPTION_PAYMENT_PROVIDER` — leave as `mock` until a real MTN
  MoMo/Airtel Money/card integration is implemented behind the existing
  `PaymentProvider` interface

Never commit `.env.production`.

### Using Supabase Postgres

In the Supabase dashboard, open **Connect** and copy the connection strings
for your project. Set `DATABASE_URL` to the **Transaction pooler** URI for
the API's runtime connection, and `DIRECT_URL` to the **Direct connection**
URI for Prisma migrations and administrative SQL. If the deployment host
does not support IPv6, use the Supavisor **Session pooler** URI for
`DIRECT_URL` instead. Keep the database password in `.env.production`; do
not substitute the Supabase publishable or secret API key for it.

For Prisma's transaction-pooler URL, retain Supabase's SSL option and add
`pgbouncer=true&connection_limit=1` to its query parameters (use `&` if the
URI already has query parameters). `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
and `SUPABASE_SECRET_KEY` are not used for Prisma database connections; keep
the secret API key server-side if another feature later needs it.

This repository currently has no committed Prisma migrations. To initialize
a **new, empty** Supabase database, run `npx prisma migrate dev --name init`
from `apps/api` with both URLs configured; review and commit the generated
migration. Then apply the required scripts from
`apps/api/prisma/manual-sql` using `DIRECT_URL`, following the ordering and
notes in `apps/api/prisma/migrations_notes/README.md`. Enable the `postgis`
and `vector` extensions in Supabase before running the scripts that use them.
Do not run the initialization command against a database containing data.
Once migrations are committed, deploy schema changes with
`npx prisma migrate deploy`.

The production Compose file still starts its local Postgres service, but the
API will use the Supabase endpoint configured by `DATABASE_URL`.

## 4. Build and start the stack

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

This starts: `postgres` (with PostGIS), `redis`, `minio`, the `api`
(NestJS), the `web` (Next.js), and `nginx` in front of both.

## 5. Run migrations and enable PostGIS

Run this only after the Prisma migration files have been generated and
committed:

```bash
docker compose -f infra/docker/docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f infra/docker/docker-compose.prod.yml exec api npx prisma db seed
```

For Supabase, run the required manual SQL scripts against the database using
its direct or session-pooler connection; do not send administrative SQL
through the transaction pooler. For the bundled Postgres service, apply the
scripts through the `postgres` container as described by the project setup.

## 6. TLS (Let's Encrypt / certbot)

The provided `infra/nginx/nginx.conf` serves the ACME HTTP-01 challenge
path already. A minimal certbot flow:

```bash
docker run --rm -v bii_certbot_www:/var/www/certbot -v bii_certbot_conf:/etc/letsencrypt \
  certbot/certbot certonly --webroot -w /var/www/certbot -d app.example.com
```

Then uncomment the HTTPS redirect in `nginx.conf`, add a `server { listen
443 ssl; ... }` block pointing `ssl_certificate`/`ssl_certificate_key` at
`/etc/letsencrypt/live/app.example.com/`, and reload:

```bash
docker compose -f infra/docker/docker-compose.prod.yml exec nginx nginx -s reload
```

Set up a cron job or systemd timer to renew (`certbot renew`) and reload
nginx every ~60 days.

## 7. MinIO bucket

On first boot, create the bucket MinIO will store uploads in (matches
`S3_BUCKET` in your env):

```bash
docker compose -f infra/docker/docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
docker compose -f infra/docker/docker-compose.prod.yml exec minio \
  mc mb local/bii-localfinder
docker compose -f infra/docker/docker-compose.prod.yml exec minio \
  mc anonymous set download local/bii-localfinder
```

(Swap this for real S3 + IAM policies whenever you outgrow a single VPS.)

## 8. Health checks & logs

```bash
docker compose -f infra/docker/docker-compose.prod.yml ps
docker compose -f infra/docker/docker-compose.prod.yml logs -f api
docker compose -f infra/docker/docker-compose.prod.yml logs -f web
```

Swagger docs are disabled in production (`NODE_ENV=production` in the
compose file already sets this) — the `main.ts` bootstrap only mounts
`/api/docs` outside production.

## 9. Backups

At minimum, schedule nightly `pg_dump` of the `postgres` volume and copy
it off-box:

```bash
docker compose -f infra/docker/docker-compose.prod.yml exec postgres \
  pg_dump -U bii bii_localfinder | gzip > backup-$(date +%F).sql.gz
```

## 10. Scaling beyond one VPS

This MVP is a modular monolith by design (spec: "not microservices"). When
you outgrow one box, the natural next steps — in the order the codebase
already supports without a rewrite — are:

1. Move Postgres and Redis to managed services.
2. Point `S3_ENDPOINT` at real S3/Cloudflare R2 instead of MinIO.
3. Run multiple `api` replicas behind nginx (Socket.IO will need a Redis
   adapter — `@socket.io/redis-adapter` — to fan out events across
   replicas; not needed for a single instance).
4. Swap `PostgresProviderSearchService` for an OpenSearch implementation
   of the same `ProviderSearchService` interface (spec §51) if search
   volume outgrows Postgres full-text/PostGIS.
5. Only then consider container orchestration (Kubernetes, ECS, etc.) —
   not before it's actually needed.
