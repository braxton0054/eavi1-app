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

function campusAdminPassword() {
  const fromEnv = process.env.SEED_CAMPUS_ADMIN_PASSWORD?.trim();
  return fromEnv || randomBytes(12).toString("base64url");
}

async function seedCampuses() {
  for (const campus of campuses) {
    await prisma.campus.upsert({
      where: { code: campusCode(campus.name) },
      update: { name: campus.name, place: campus.place, phone: campus.phone },
      create: {
        code: campusCode(campus.name),
        name: campus.name,
        place: campus.place,
        phone: campus.phone,
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
