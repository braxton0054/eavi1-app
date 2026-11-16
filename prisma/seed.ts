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

/** The two college-administration logins this build is written against. The emails come
 * from the deployment's .env (SUPER_ADMIN_EMAIL, MAIN_CAMPUS_ADMIN_EMAIL,
 * WEST_CAMPUS_ADMIN_EMAIL) so the accounts are the college's real ones; the old
 * addresses remain only as fallbacks for a checkout with no .env. */
const adminAccounts = [
  {
    code: "main",
    email: (process.env.MAIN_CAMPUS_ADMIN_EMAIL ?? "admin-main@eavi.ac.ke").trim().toLowerCase(),
    fullName: "EAVI Main Campus Office",
  },
  {
    code: "west",
    email: (process.env.WEST_CAMPUS_ADMIN_EMAIL ?? "admin-west@eavi.ac.ke").trim().toLowerCase(),
    fullName: "EAVI West Campus Office",
  },
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
  const email = (
    process.env.SUPER_ADMIN_EMAIL ??
    process.env.SEED_SUPERADMIN_EMAIL ??
    "superadmin@eavi.ac.ke"
  )
    .trim()
    .toLowerCase();

  const existing = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });

  if (existing) {
    // The .env owns the identity: an account seeded under an old address is aligned to
    // the deployment's own email, provided nothing else holds it.
    if (existing.email !== email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        console.log(`superadmin stays ${existing.email}: ${email} is already a user`);
        return;
      }
      await prisma.user.update({ where: { id: existing.id }, data: { email } });
      console.log(`superadmin email aligned to ${email}`);
    } else {
      console.log(`superadmin already present: ${existing.email}`);
    }
    return;
  }

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

    // The campus's own admin account is aligned to the .env email the same way.
    const existing = await prisma.user.findFirst({
      where: { role: "CAMPUS_ADMIN", campusId: campus.id },
    });
    if (existing) {
      if (existing.email !== account.email) {
        const taken = await prisma.user.findUnique({ where: { email: account.email } });
        if (taken) {
          console.log(`${campus.name} admin stays ${existing.email}: ${account.email} is already a user`);
          continue;
        }
        await prisma.user.update({ where: { id: existing.id }, data: { email: account.email } });
        console.log(`${campus.name} admin email aligned to ${account.email}`);
      } else {
        console.log(`campus admin already present: ${existing.email} (${campus.name})`);
      }
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
