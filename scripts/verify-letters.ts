import "../load-env";

import { prisma } from "../lib/prisma";
import { approvedLetterForOffice, issueApprovedLetter, letterForDownload } from "../lib/admissions/issue";

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("admission letters\n");
  const program = await prisma.program.findFirst({ select: { id: true } });
  const campus = await prisma.campus.findFirst({ select: { id: true } });
  if (!program || !campus) throw new Error("Seed data missing");

  const application = await prisma.application.create({
    data: {
      reference: `APP/TEST/${Date.now()}`,
      fullName: "Security Verification Applicant",
      phone: "+254700000001",
      email: "letter-security-test@eavi.test",
      gender: "MALE",
      grade: "A",
      programId: program.id,
      campusId: campus.id,
      status: "APPROVED",
      contactVerifiedAt: new Date(),
      contactVerificationMethod: "COUNTER",
    },
    select: { id: true, reference: true },
  });

  try {
    const issued = await prisma.$transaction((tx) =>
      issueApprovedLetter(tx, application.id, { id: "security-test", email: "security-test@eavi.test" }),
    );
    const again = await prisma.$transaction((tx) =>
      issueApprovedLetter(tx, application.id, { id: "security-test", email: "security-test@eavi.test" }),
    );
    check("an approved, contact-verified application gets a letter", Boolean(issued?.verifyToken));
    check("re-issuing rotates the public token rather than duplicating the row", Boolean(issued && again && issued.verifyToken !== again.verifyToken));

    const office = await approvedLetterForOffice(application.id);
    check("the authenticated office can retrieve the approved letter", Boolean(office));
    check("the public QR token cannot authorize a private PDF download", (await letterForDownload(application.reference, again!.verifyToken)) === null);

    const base = process.env.VERIFY_BASE ?? "http://localhost:3000";
    const genuine = await (await fetch(`${base}/verify/${again!.verifyToken}`)).text();
    check("the verification page says the letter is genuine", genuine.includes("Genuine admission letter"));
    check("it shows the reference", genuine.includes(application.reference));
    check("it states the letter is not an offer of admission", genuine.includes("not an offer of admission"));

    await prisma.offerLetter.update({ where: { applicationId: application.id }, data: { revokedAt: new Date() } });
    const revoked = await (await fetch(`${base}/verify/${again!.verifyToken}`)).text();
    check("a revoked letter says so", revoked.includes("This letter was cancelled"));
    check("the office cannot download a revoked letter", (await approvedLetterForOffice(application.id)) === null);

    await prisma.offerLetter.update({
      where: { applicationId: application.id },
      data: { revokedAt: null, expiresAt: new Date("2020-01-01") },
    });
    const expired = await (await fetch(`${base}/verify/${again!.verifyToken}`)).text();
    check("an expired letter says so", expired.includes("This letter has expired"));
    check("the office cannot download an expired letter", (await approvedLetterForOffice(application.id)) === null);

    console.log(failures === 0 ? "\nAll admission letter checks passed." : `\n${failures} check(s) failed.`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    await prisma.application.delete({ where: { id: application.id } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
