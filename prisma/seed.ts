import "dotenv/config";

import { randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth";
import { campuses } from "@/lib/campuses";
import { prisma } from "@/lib/prisma";

const campusCode = (name: string) =>
  name
    .toLowerCase()
    .replace(/^([a-z]+)\s+campus$|^([a-z]+)\s+office$/, "$1$2")
    .replace(/[^a-z0-9]+/g, "-");

/** The two college-administration logins this build is written against. */
const adminAccounts = [
  { code: "main", email: "admin-main@eavi.ac.ke", fullName: "EAVI Main Campus Office" },
  { code: "west", email: "admin-west@eavi.ac.ke", fullName: "EAVI West Campus Office" },
];

/**
 * LOCAL TESTING ONLY.
 *
 * The seed fills a developer's database with the campuses and logins needed to click through
 * the portal. A production database is loaded with the college's real data — campuses,
 * programmes, staff and students as the school records them — so this must never run there.
 *
 * Two things keep it out of production: the guard below refuses to run against a hosted
 * database, and no password is ever invented, so an unset value stops the seed rather than
 * creating an account somebody can guess.
 */
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const hosted = /neon\.tech|supabase|amazonaws|azure|render\.com|railway|vercel/i.test(url);
  if (hosted || process.env.NODE_ENV === "production") {
    throw new Error(
      "This seed is for local testing only. Point DATABASE_URL at a local database, or load real data instead.",
    );
  }
}

function campusAdminPassword(): string {
  const value = process.env.SEED_CAMPUS_ADMIN_PASSWORD?.trim() ?? "";
  if (value.length < 10) {
    throw new Error("Set SEED_CAMPUS_ADMIN_PASSWORD (at least 10 characters) before seeding.");
  }
  return value;
}

async function seedCampuses() {
  for (const campus of campuses) {
    // The Town Office handles paperwork rather than teaching, so it is never handed students.
    const takesApplicants = !/office/i.test(campus.name);

    await prisma.campus.upsert({
      where: { code: campusCode(campus.name) },
      update: { name: campus.name, place: campus.place, phone: campus.phone, takesApplicants },
      create: {
        code: campusCode(campus.name),
        name: campus.name,
        place: campus.place,
        phone: campus.phone,
        takesApplicants,
      },
    });
  }
}

async function ensureSuperadmin() {
  const existing = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });

  if (existing) {
    console.log(`superadmin already present: ${existing.email}`);
    return;
  }

  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@eavi.ac.ke")
    .trim()
    .toLowerCase();
  const password =
    process.env.SEED_SUPERADMIN_PASSWORD ?? randomBytes(12).toString("base64url");

  await prisma.user.create({
    data: {
      email,
      fullName: "EAVI Superadmin",
      passwordHash: await hashPassword(password),
      role: "SUPERADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Seeded the first superadmin.");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

/**
 * Each campus admin sees only their own campus: every portal query filters on the campus
 * attached to the account, so this assignment is the whole of the isolation rule.
 */
async function ensureCampusAdmins() {
  for (const account of adminAccounts) {
    const campus = await prisma.campus.findUnique({ where: { code: account.code } });
    if (!campus) {
      console.log(`skipped ${account.email}: no campus coded "${account.code}"`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (existing) {
      console.log(`campus admin already present: ${existing.email} (${campus.name})`);
      continue;
    }

    const value = campusAdminPassword();

    await prisma.user.create({
      data: {
        email: account.email,
        fullName: account.fullName,
        passwordHash: await hashPassword(value),
        role: "CAMPUS_ADMIN",
        status: "ACTIVE",
        campusId: campus.id,
      },
    });

    console.log(`Seeded the ${campus.name} administrator.`);
    console.log(`  email:    ${account.email}`);
    console.log(`  password: ${value}`);
  }
}

async function main() {
  assertLocalDatabase();

  await seedCampuses();
  await ensureSuperadmin();
  await ensureCampusAdmins();

  console.log(
    "Every password above prints once and is stored only as a scrypt hash. Sign in and replace each one before inviting anyone else.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
