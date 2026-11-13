import "dotenv/config";
import pg from "pg";
import { hashPassword } from "../lib/auth";

const { Client } = pg;

async function main() {
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "";
  if (password.length < 10) throw new Error("SEED_SUPERADMIN_PASSWORD missing/short");
  const hash = await hashPassword(password);
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    `update "users" set "passwordHash" = $1, "updatedAt" = now() where email = 'superadmin@eavi.ac.ke' and role = 'SUPERADMIN'`,
    [hash],
  );
  console.log(`updated ${r.rowCount} superadmin account(s)`);
  await c.end();
}
main();
