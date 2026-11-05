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
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

# The app: only the traced standalone output plus static assets and public files.
FROM node:24-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --shell /usr/sbin/nologin nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

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
