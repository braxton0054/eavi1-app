#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; refusing to touch the database." >&2
  exit 1
fi

echo "Applying pending migrations…"
./node_modules/.bin/prisma migrate deploy
echo "Migrations complete."
