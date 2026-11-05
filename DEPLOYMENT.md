# Deploying the EAVI portal

## What ships

| File | Role |
|---|---|
| `Dockerfile` | `runner` target: the Next standalone server. `migrate` target: a one-off that applies pending Prisma migrations. |
| `docker-compose.yml` | Postgres + `migrate` + `app` on one server. Reads settings from `.env` beside it. |
| `deploy.example.env` | Template for that `.env`. Copy it, fill it in, never commit it. |
| `.github/workflows/ci.yml` | On every push/PR: `npm ci`, `prisma validate`, eslint, `tsc --noEmit`, `next build`, then builds both images. |
| `.github/workflows/release.yml` | On push to `main`: publishes `ghcr.io/braxton0054/eavi1-app` (`latest`, `sha-…`) plus the `:migrate-<sha>` image. |

## First deploy on a server

```bash
sudo apt-get install -y docker.io docker-compose-v2   # or get.docker.com's script
git clone https://github.com/braxton0054/eavi1-app && cd eavi1-app
cp deploy.example.env .env      # then set a strong POSTGRES_PASSWORD
docker compose up -d --build    # migrates, then starts the app on APP_PORT
curl -s localhost:3000/api/health
```

If `POSTGRES_PASSWORD` is missing, compose refuses to start rather than inventing one.

## Later releases

```bash
docker compose pull app        # or set APP_IMAGE to the sha tag you want to pin
docker compose up -d --build migrate app
```

`migrate` runs to completion and exits before the app restarts, so a failed migration
leaves the previous app container serving traffic instead of a half-upgraded one.

## Two things to settle before going live

1. **HTTPS is required, not optional.** `app/api/auth/login/route.ts:92` sets the session
   cookie with `secure: process.env.NODE_ENV === "production"`, so over plain HTTP the
   browser drops it and nobody can sign in. Terminate TLS in front of the app (Caddy,
   nginx, or your host's managed certificate) and point the proxy at `127.0.0.1:3000`.
2. **Seed the production database.** `prisma/seed.ts` creates campuses and demo accounts.
   Run it only if that starting data is wanted:
   `docker compose run --rm --entrypoint ./node_modules/.bin/tsx migrate prisma/seed.ts`.
   The live admin accounts must then get their own passwords — the seeded ones are shared
   and documented.

## Grants the release workflow needs

GitHub → repository → Settings → Actions → General → Workflow permissions → **Read and
write**, so `GITHUB_TOKEN` may push to GHCR. On the first run the package appears under
the account as private; the server authenticates with a personal token that has
`read:packages`:

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u braxton0054 --password-stdin
```
