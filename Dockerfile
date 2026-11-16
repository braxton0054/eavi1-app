# syntax=docker/dockerfile:1

# Production image for the EAVI portal.
#
#   docker build --target runner -t eavi-portal .   the app itself
#   docker build --target migrate -t eavi-migrate . the one-off migration runner
#
# Debian slim, not alpine: Prisma's migration engine here is the debian-openssl-3.0.x
# binary, and glibc avoids the musl workarounds.

FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# @prisma/client's postinstall generates the client, which needs schema + lockfile.
RUN npm ci --no-audit --no-fund

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# `prisma generate` loads prisma.config.ts, and that config resolves DATABASE_URL on
# import — so the variable has to exist even though the build never opens a connection.
# A build argument, never an image environment variable: the runner stage does not copy it.
ARG DATABASE_URL=postgresql://build-only:build-only@127.0.0.1:5432/build-only
ENV DATABASE_URL=$DATABASE_URL
# `NEXT_PUBLIC_*` is inlined into the client bundle at build time, so the public
# origin has to be present here — a runtime env var would arrive too late.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# The push public key rides into the bundle the same way; the private key is runtime-only.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build
# The chat server, pre-compiled so the runtime needs no TypeScript tooling.
RUN npm run server:build

# The app: only the traced standalone output plus static assets and public files.
FROM node:24-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app

# Chromium for the student-record PDF.
#
# Printing a record renders the page in a real browser; without one the print route can only
# return 503. `chromium` plus the small font set it needs is added here rather than at build
# time, because it is a runtime dependency of one route and has no place in the build image.
# The fonts matter: a container with no fonts renders a PDF of empty boxes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --shell /usr/sbin/nologin nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# The custom entry point: Next's own server plus Socket.IO on the same port, built by
# `npm run server:build` in the builder stage so the image runs plain JavaScript.
#
# The full dependency tree comes along rather than a hand-written list of package names. The
# chat server imports Prisma's driver adapter directly, and Next's standalone tracing does not
# follow that path — naming each package by hand only moves the failure one package later, as
# it did for @prisma/driver-adapter-utils, then @prisma/debug, then postgres-array.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/server.mjs ./server.mjs
COPY --from=build --chown=nextjs:nodejs /app/generated ./generated
USER nextjs
EXPOSE 3000
# Not `server.js`: that is Next's standalone server, which has no Socket.IO attached.
CMD ["node", "server.mjs"]

# Migrations stay out of the app image so it can be minimal and read-only.
FROM node:24-slim AS migrate
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json /app/prisma.config.ts ./
COPY --from=deps /app/prisma ./prisma
COPY docker/migrate.sh /usr/local/bin/eavi-migrate
ENTRYPOINT ["/usr/local/bin/eavi-migrate"]
