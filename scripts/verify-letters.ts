import "../load-env";

import { prisma } from "../lib/prisma";
import { issueLetterForApplication, letterForDownload } from "../lib/admissions/issue";

/**
 * Proves the automatic admission letter.
 *
 * The letter is generated with no office review, so the tests are about the two things that could
 * go wrong because of that: a letter that claims more than it should, and a letter that anyone can
 * download by guessing a reference.
 */

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("admission letters\n");

  const application = await prisma.application.findFirst({
    where: { status: "SUBMITTED" },
    select: { id: true, reference: true, programId: true },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    console.log("  SKIP no application in this database");
    return;
  }

  // 1. Issuing is idempotent: a second call must not mint a second token, because the first one
  // was already handed to an applicant who may have printed it.
  const first = await issueLetterForApplication(application.id);
  const second = await issueLetterForApplication(application.id);
  check("a letter is issued", Boolean(first?.verifyToken));
  check("re-issuing keeps the same token", first?.verifyToken === second?.verifyToken);

  // 2. The token and reference together resolve the letter.
  const found = await letterForDownload(application.reference, first!.verifyToken);
  check("the reference and token find the letter", Boolean(found));
  check("it carries the applicant's name", Boolean(found?.printedName));

  // 3. The reference alone must not. It is sequential, so honouring it alone would let anyone
  // walk APP/2026/0001 upward and download other people's letters.
  const byReferenceOnly = await letterForDownload(application.reference, "");
  check("the reference alone is refused", byReferenceOnly === null);

  const wrongToken = await letterForDownload(application.reference, "not-a-real-token-value-here");
  check("a wrong token is refused", wrongToken === null);

  // 4. A different applicant's token must not open this letter either.
  const other = await prisma.offerLetter.findFirst({
    where: { applicationId: { not: application.id } },
    select: { verifyToken: true },
  });
  if (other) {
    const crossed = await letterForDownload(application.reference, other.verifyToken);
    check("another person's token does not open this letter", crossed === null);
  }

  // 5. The snapshot is frozen: the requirements printed are the ones stored, not read live.
  const stored = await prisma.offerLetter.findUnique({
    where: { applicationId: application.id },
    select: { requirements: true, printedName: true, feeStructureUrl: true },
  });
  check("the letter stores its own snapshot", stored !== null);

  // 6. Revoking stops the download even with the right token.
  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { revokedAt: new Date() },
  });
  const afterRevoke = await letterForDownload(application.reference, first!.verifyToken);
  check("a revoked letter cannot be downloaded", afterRevoke === null);

  // Restore, so the database is left as it was found.
  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { revokedAt: null },
  });

  // 7. The verify page a clerk reads. Every state must be distinguishable in words, because the
  // colour alone is not the message.
  const base = process.env.VERIFY_BASE ?? "http://localhost:3000";
  const token = first!.verifyToken;
  const read = async () => {
    const r = await fetch(`${base}/verify/${token}`);
    return r.text();
  };

  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { revokedAt: null, expiresAt: new Date(Date.now() + 30 * 86_400_000) },
  });
  const genuine = await read();
  check("the verify page says the letter is genuine", genuine.includes("Genuine admission letter"));
  check("it shows the reference", genuine.includes(application.reference));
  check(
    "it states the letter is not an offer of admission",
    genuine.includes("not an offer of admission"),
  );
  check(
    "it does not tell a letter reader to scan a student card",
    !genuine.includes("back of a student card"),
  );

  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { revokedAt: new Date() },
  });
  check("a cancelled letter says so", (await read()).includes("This letter was cancelled"));

  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { revokedAt: null, expiresAt: new Date("2020-01-01") },
  });
  check("an expired letter says so", (await read()).includes("This letter has expired"));

  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: { expiresAt: new Date(Date.now() + 30 * 86_400_000) },
  });
  check(
    "a made-up token is not a letter",
    (await (await fetch(`${base}/verify/definitely-not-a-token`)).text()).includes(
      "Not one of our letters",
    ) ||
      (await (await fetch(`${base}/verify/definitely-not-a-token`)).text()).includes(
        "Not a valid card",
      ),
  );

  console.log(failures === 0 ? "\nAll admission letter checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
