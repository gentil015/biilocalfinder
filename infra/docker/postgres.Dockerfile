# postgis/postgis already ships PostGIS built from the pgdg apt repo for
# this Postgres major version; pgvector is available from the same repo as
# `postgresql-<major>-pgvector`, so it's added here rather than switching
# base images (there's no single official image with both extensions).
FROM postgis/postgis:16-3.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16-pgvector \
  && rm -rf /var/lib/apt/lists/*
