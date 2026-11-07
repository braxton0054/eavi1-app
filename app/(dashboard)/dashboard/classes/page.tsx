import Link from "next/link";

import { getClasses } from "@/lib/dal/classes";
import { requireCollegeAdmin } from "@/lib/session";
import { pages } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { RecordCard, RecordCardGrid, type RecordCardData } from "@/components/dashboard/record-card";
import { StatusChip } from "@/components/dashboard/status-chip";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

const copy = pages.classes;

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ includeArchived?: string; merged?: string }>;
}) {
  const { includeArchived } = await searchParams;
  const scope = await requireCollegeAdmin();

  const rows = await getClasses({ includeArchived: includeArchived === "1" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <ShimmerButton asChild>
            <Link href="/dashboard/classes/new">{copy.create.button}</Link>
          </ShimmerButton>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {/* The archived classes stay one tap away rather than being hidden behind a menu. */}
        <Link
          href={includeArchived === "1" ? "/dashboard/classes" : "/dashboard/classes?includeArchived=1"}
          className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
        >
          {copy.filter.includeArchived}
        </Link>
        {scope.campusId === null && (
          <span className="text-sm text-eavi-muted-text">Showing every campus.</span>
        )}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title={copy.empty.title}
            body={copy.empty.body}
            icon="students"
            action={
              <ShimmerButton asChild>
                <Link href="/dashboard/classes/new">{copy.create.button}</Link>
              </ShimmerButton>
            }
          />
        </Panel>
      ) : (
        <RecordCardGrid>
          {rows.map((row) => {
            const card: RecordCardData = {
              id: row.id,
              href: `/dashboard/classes/${row.id}`,
              eyebrow: `${row.programCode} · ${row.year}`,
              title: row.name,
              subtitle: `${row.programName} · ${row.intakeName}`,
              status: (
                <StatusChip tone={row.status === "ACTIVE" ? "success" : "neutral"}>
                  {row.status === "ACTIVE" ? "Active" : copy.card.archived}
                </StatusChip>
              ),
              facts: [
                {
                  label: copy.card.students,
                  value: `${row.students} ${row.students === 1 ? copy.card.student : copy.card.students}`,
                  showLabel: true,
                },
                { label: copy.card.placements, value: row.placements, showLabel: true },
              ],
              note: row.note ?? undefined,
            };
            return <RecordCard key={row.id} card={card} openLabel={copy.card.open} />;
          })}
        </RecordCardGrid>
      )}
    </div>
  );
}
