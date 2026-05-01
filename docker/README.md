# `docker` — local stack

Docker Compose for local development/self-host baseline.

## Services

- `postgres` (port `5432`)
- `api` (FastAPI on port `8000`)

`init-local.sql` is mounted into Postgres init directory and applied on first DB initialization.

## Start

From repo root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Start only Postgres

```bash
docker compose -f docker/docker-compose.yml up postgres
```

## Stop

```bash
docker compose -f docker/docker-compose.yml down
```

## Reset local DB volume

```bash
docker compose -f docker/docker-compose.yml down -v
```

