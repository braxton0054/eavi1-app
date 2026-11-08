import "../load-env";

import { prisma } from "../lib/prisma";
import { checkGrade, gradeLabel, gradeRank, meetsMinimum, nextGradeUp } from "../lib/admissions/grade";
import type { EntryGrade } from "../generated/prisma/enums";

/**
 * Proves the KCSE grade gate and its suggestions.
 *
 * The dangerous bug here is never "the comparison is written wrong" in the obvious direction — it
 * is the boundary. A programme asking C must admit a C and refuse a C-, and off-by-one in either
 * direction either turns away qualified applicants or admits people the college cannot register.
 */

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("KCSE grade gate\n");

  // 1. The ordering itself. A better grade must rank lower.
  check("A ranks best", gradeRank("A") === 0);
  check("E ranks worst", gradeRank("E") === 11);
  check("A beats B+", gradeRank("A") < gradeRank("B_PLUS"));
  check("C+ beats C", gradeRank("C_PLUS") < gradeRank("C"));
  check("C beats C-", gradeRank("C") < gradeRank("C_MINUS"));
  check("D beats D-", gradeRank("D") < gradeRank("D_MINUS"));

  // 2. The boundary, both directions. A minimum is inclusive.
  check("an equal grade passes", meetsMinimum("C", "C"));
  check("a better grade passes", meetsMinimum("C_PLUS", "C"));
  check("a much better grade passes", meetsMinimum("A", "E"));
  check("one grade below fails", meetsMinimum("C_MINUS", "C") === false);
  check("a much worse grade fails", meetsMinimum("E", "A") === false);
  check("D against a C+ minimum fails", meetsMinimum("D", "C_PLUS") === false);

  // 3. The whole ladder, checked pairwise: nobody passes a course above them and fails one below.
  const ladder: EntryGrade[] = [
    "A", "A_MINUS", "B_PLUS", "B", "B_MINUS", "C_PLUS", "C", "C_MINUS", "D_PLUS", "D", "D_MINUS", "E",
  ];
  let ladderOk = true;
  for (let i = 0; i < ladder.length; i += 1) {
    for (let j = 0; j < ladder.length; j += 1) {
      // Applicant at i versus a programme requiring j: passes exactly when i is at least as good.
      if (meetsMinimum(ladder[i], ladder[j]) !== i <= j) ladderOk = false;
    }
  }
  check("every grade against every minimum agrees with the order", ladderOk);

  // 4. Labels read as a Kenyan result slip prints them.
  check("C_MINUS reads C-", gradeLabel("C_MINUS") === "C-");
  check("B_PLUS reads B+", gradeLabel("B_PLUS") === "B+");
  check("A reads A", gradeLabel("A") === "A");

  // 5. The advice given on a refusal.
  check("C- is told the next grade up is C", nextGradeUp("C_MINUS") === "C");
  check("nobody is told to aim above A", nextGradeUp("A") === null);

  // 6. Against the real programmes in this database.
  const programmes = await prisma.program.findMany({
    where: { archivedAt: null, campuses: { some: { takesApplicants: true } } },
    select: { id: true, name: true, minKcseGrade: true },
  });

  if (programmes.length === 0) {
    console.log("  SKIP no programmes accepting applicants in this database");
  } else {
    const lowest = programmes.reduce((a, b) =>
      gradeRank(a.minKcseGrade) > gradeRank(b.minKcseGrade) ? a : b,
    );
    const highest = programmes.reduce((a, b) =>
      gradeRank(a.minKcseGrade) < gradeRank(b.minKcseGrade) ? a : b,
    );

    // A top-grade applicant must clear everything.
    const top = await checkGrade("A" as EntryGrade, programmes[0].id);
    check("an A qualifies for every programme on offer", top.ineligible.length === 0,
      `${top.eligible.length} eligible, ${top.ineligible.length} not`);

    // The lowest entry requirement must be reachable by exactly the grade it names.
    const atFloor = await checkGrade(lowest.minKcseGrade, lowest.id);
    check(
      `a ${gradeLabel(lowest.minKcseGrade)} qualifies for the lowest requirement (${lowest.name})`,
      atFloor.eligible.some((entry) => entry.id === lowest.id),
    );

    // An E must clear nothing that asks above E.
    const none = await checkGrade("E" as EntryGrade, programmes[0].id);
    check(
      "an E qualifies only for programmes that ask E or nothing higher",
      none.eligible.every((entry) => entry.meets && gradeRank(entry.minGrade) >= gradeRank("E")),
    );

    /*
     * One grade below the floor clears nothing, which is what drives the "no course fits"
     * message.
     *
     * This can only be asserted when some programme asks above E. Once the college lists a
     * programme that admits E — a certificate, realistically — E is the floor of the ladder
     * itself, there is no grade below it, and "nothing fits" is unreachable by definition. The
     * meaningful check then becomes the mirror image: E clears exactly those programmes.
     */
    if (gradeRank(lowest.minKcseGrade) < gradeRank("E")) {
      const belowFloor = await checkGrade(
        ladder[Math.min(gradeRank(lowest.minKcseGrade) + 1, ladder.length - 1)],
        programmes[0].id,
      );
      check(
        `below the lowest requirement (${gradeLabel(lowest.minKcseGrade)}) there is nothing to suggest`,
        belowFloor.eligible.length === 0,
        `${belowFloor.eligible.length} eligible`,
      );
    } else {
      const atFloor = await checkGrade("E" as EntryGrade, programmes[0].id);
      check(
        "the lowest requirement is E, so every programme accepting E is offered and nothing is refused",
        atFloor.eligible.every((entry) => gradeRank(entry.minGrade) === gradeRank("E")),
        `${atFloor.eligible.length} eligible`,
      );
    }

    // 7. Suggestions are genuinely obtainable: every one must admit the grade that earned it.
    const midGrade = highest.minKcseGrade;
    const mid = await checkGrade(midGrade, programmes[0].id);
    check(
      `every suggestion for a ${gradeLabel(midGrade)} really does accept that grade`,
      mid.eligible.every((entry) => meetsMinimum(midGrade, entry.minGrade)),
    );

    // 8. Suggestions are ordered best-requirement-first, so the closest match reads first.
    const ordered = mid.eligible.every(
      (entry, i) => i === 0 || gradeRank(mid.eligible[i - 1].minGrade) <= gradeRank(entry.minGrade),
    );
    check("suggestions are ordered from the least to the most attainable", ordered);

    // 9. The selected programme is marked, so the UI does not re-offer what was just refused.
    check(
      "the programme they chose is marked as selected",
      mid.eligible.some((entry) => entry.selected) ||
        mid.ineligible.some((entry) => entry.selected),
    );
    check(
      "a refused programme appears as ineligible, not as a suggestion",
      mid.ineligible.every((entry) => !entry.meets),
    );
  }

  console.log(failures === 0 ? "\nAll grade checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
