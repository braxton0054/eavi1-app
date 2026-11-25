import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { PageHeader, Panel, EmptyState } from "@/components/dashboard/panel";
import { common, pages } from "@/lib/content/dashboard";

export const dynamic = "force-dynamic";

/**
 * Every published fee structure, grouped by department and opened inline in the browser.
 * Read-only: fees are published by the super admin on the programme's fee screen. The
 * document itself is generated from the plan, so it changes the moment the plan changes.
 */
export default async function FeeStructuresPage() {
  const scope = await requireCollegeAdmin();
  const programs = await prisma.program.findMany({
    where: {
      archivedAt: null,
      ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
      feePlans: { some: { isActive: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      department: { select: { name: true } },
      feePlans: {
        where: { isActive: true },
        take: 1,
        select: { version: true, totalAmount: true },
      },
    },
  });

  const groups = new Map<string, typeof programs>();
  for (const program of programs) {
    const key = program.department?.name ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), program]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee structures"
        description="Published programme fees, grouped by department. Open a document to view or share it."
      />

      {programs.length === 0 ? (
        <Panel>
          <EmptyState
            title="No published fee structures"
            body="Fee structures appear here once a programme's fee plan is published."
            icon="accounts"
          />
        </Panel>
      ) : (
        [...groups.entries()].map(([department, rows]) => (
          <Panel key={department} title={department}>
            <ul className="divide-y divide-eavi-border">
              {rows.map((program) => (
                <li key={program.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{program.name}</span>
                    <span className="block text-xs text-eavi-muted-text">
                      {program.code} · version {program.feePlans[0].version}
                    </span>
                  </span>
                  <Link
                    href={`/api/programs/${program.id}/fee-structure?format=pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
                  >
                    View PDF
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
