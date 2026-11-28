# Deploying the EAVI portal

## What ships

| File | Role |
|---|---|
| `Dockerfile` | `runner` target: the Next standalone server. `migrate` target: a one-off that applies pending Prisma migrations. |
| `docker-compose.yml` | Postgres + Redis + `migrate` + `app` + `openwa` on one server. Reads settings from `.env` beside it. |
| `deploy.example.env` | Template for that `.env`. Copy it, fill it in, never commit it. |
| `.github/workflows/ci.yml` | On every push/PR: `npm ci`, `prisma validate`, eslint, `tsc --noEmit`, `next build`, then builds both images. |
| `.github/workflows/release.yml` | On push to `main`: publishes `ghcr.io/braxton0054/eavi1-app` (`latest`, `sha-…`) plus the `:migrate-<sha>` image. |
| `.github/workflows/deploy.yml` | On a **green** CI run for `main`: deploys to the VPS. See below. |

## Automatic deploy

`deploy.yml` runs on the box's own self-hosted runner (`/opt/actions-runner`, service
`actions.runner.braxton0054-eavi1-app.*`), so no inbound SSH or webhook is needed. It
triggers only when CI concludes successfully for `main`, then:

1. resolves the commit CI validated — `github.event.workflow_run.head_sha`, not `main`,
   so a concurrent push cannot deploy something untested;
2. resets `/root/eavi1-app` to that commit, keeping the untracked `.env`;
3. runs `docker compose up -d --build` — the build finishes before any container is
   recreated, so a failed build leaves the previous release serving;
4. gates on `https://$PUBLIC_HOST/api/health` and prints the running commit.

So shipping is: **push to `main` → CI → deploy.** Nothing to run by hand.

## Application-letter delivery

A valid public application is approved, issued an acknowledgement letter, and delivered
without an office click:

1. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` send the private download link by email.
2. The embedded `openwa` service sends the same link to the applicant's phone.
3. A super admin opens **Administration → WhatsApp setup** and scans the QR once with
   WhatsApp → Settings → Linked devices → Link a device. The QR refreshes itself until
   the session is `ready`.

OpenWA is part of this Compose stack, not a separate project on the VPS. It listens on
container port `2785`, publishes on host port `OPENWA_PORT` (default `2786`), and runs with
its own dashboard disabled (`SERVE_DASHBOARD=false`). Its state lives in the `openwa-data`
volume. Set `OPENWA_API_KEY` to the same long random value in both the portal and gateway;
without it the service cannot start. Use a different `OPENWA_PORT` from any other OpenWA
instance already on the server.

Delivery is best effort: if email or WhatsApp is unavailable, the application and its
letter are still committed and an audit row records the failed channel.

The image is built on the box rather than pulled from GHCR on purpose: the package is
private, so pulling would need a token with `read:packages`.

`PUBLIC_HOST` and `DEPLOY_PATH` live in the workflow's `env:`. To deploy a specific commit
without waiting for a push, run the workflow manually (`workflow_dispatch`) and pass `sha`.

### Runner notes

- Runs as root (`RUNNER_ALLOW_RUNASROOT=1`), because it needs the Docker socket. Anything
  that can run on that runner is effectively root on this host — keep the repo private and
  do not let untrusted branches reach this workflow.
- The runner has no stored git credentials. The deploy job passes a `contents: read`
  job token to `git` through an inline credential helper, so no token is written into
  the deployment's `.git/config`.


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
