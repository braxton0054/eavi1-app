import Link from "next/link";
import { notFound } from "next/navigation";

import { getProgramFees } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { PageHeader, Panel } from "@/components/dashboard/panel";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { ProgramFeeEditor } from "@/components/dashboard/program-fee-editor";
import { formatDate, money } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";
import type { PeriodDraft } from "@/lib/fees/periods";

const copy = pages.programs;
const feeCopy = copy.feePlan;
const tabs = copy.sectionTabs;

const semesterTone: Record<string, ChipTone> = {
  PLANNED: "info",
  ACTIVE: "success",
  COMPLETED: "neutral",
};

export default async function ProgramFeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getProgramFees>> | null = null;
  try {
    data = await getProgramFees(id);
  } catch (error) {
    // The getter throws "not_found" for a missing programme or another campus's programme.
    if (error instanceof Error && error.message === "not_found") data = null;
    else throw error;
  }

  if (!data) notFound();

  const { program, plan, calendar, cadences, campusId, scope } = data;
  // The fee plan is part of the shared catalogue: only the super admin sets the amounts.
  const canManage = scope.role === "SUPERADMIN";

  // The rows are handed to the client as plain strings: Prisma's Decimal cannot cross the
  // server/client boundary, and the editor only needs what fits in the form.
  const initialPeriods: PeriodDraft[] = (plan?.periods ?? []).map((period) => ({
    label: period.label,
    amount: String(Number(period.amount)),
    yearIndex: period.yearIndex,
    semesterNo: period.semesterNo,
    dueOffsetDays: period.dueOffsetDays ?? 0,
  }));

  const periodsPerYear = new Set(calendar.map((period) => period.sequence)).size || undefined;

  const calendarRows: Row[] = calendar.map((period) => ({
    id: period.id,
    cells: {
      name: period.name,
      starts: formatDate(period.startsAt),
      ends: formatDate(period.endsAt),
      status: (
        <StatusChip tone={semesterTone[period.status] ?? "neutral"}>
          {labels.semesterStatus[period.status]}
        </StatusChip>
      ),
    },
  }));

  const initialCadenceId = plan?.cadence.id ?? program.cadenceId;
  const initialDuration = plan?.durationMonths ?? program.durationMonths;

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/programs/${program.id}`}
        className="inline-flex min-h-8 items-center gap-1 text-sm text-eavi-muted-text hover:text-eavi-primary-text"
      >
        ← {program.name}
      </Link>

      <PageHeader
        title={feeCopy.title}
        description={feeCopy.description}
        action={
          plan ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/programs/${program.id}/fee-structure`}
                className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
              >
                View fee structure (SVG)
              </a>
              <a
                href={`/api/programs/${program.id}/fee-structure?format=pdf`}
                className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
              >
                Download fee structure (PDF)
              </a>
            </div>
          ) : null
        }
        meta={
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-eavi-muted-text">
            <span className="tabular-nums">{program.code}</span>
            <span aria-hidden>·</span>
            <span>{program.name}</span>
            <span aria-hidden>·</span>
            <span>{plan ? `${feeCopy.current(plan.version)} · ${money(plan.totalAmount)}` : common.notSet}</span>
            {campusId === null ? null : (
              <>
                <span aria-hidden>·</span>
                <span>{program.campuses.find((campus) => campus.id === campusId)?.name ?? ""}</span>
              </>
            )}
          </p>
        }
      />

      <SectionTabs
        label={tabs.label}
        tabs={[
          { href: `/dashboard/programs/${program.id}`, label: tabs.overview },
          { href: `/dashboard/programs/${program.id}/units`, label: tabs.units },
          { href: `/dashboard/programs/${program.id}/fees`, label: tabs.fees, active: true },
          { href: `/dashboard/programs/${program.id}/attachment`, label: tabs.attachment },
        ]}
      />

      <Panel title={feeCopy.periodsHeading} description={feeCopy.amountsHint}>
        <div className="p-4 sm:p-6">
          {canManage ? (
            <ProgramFeeEditor
              programId={program.id}
              cadences={cadences}
              initialCadenceId={initialCadenceId}
              initialDuration={initialDuration}
              initialPeriods={initialPeriods}
              semestersPerYear={periodsPerYear}
              copy={{
                cadence: feeCopy.cadence,
                duration: feeCopy.duration,
                durationHint: feeCopy.durationHint,
                note: feeCopy.note,
                amount: feeCopy.amount,
                periodHeader: feeCopy.periodHeader,
                offsetHeader: feeCopy.offsetHeader,
                total: feeCopy.total,
                save: feeCopy.save,
                customAdd: feeCopy.customAdd,
                customRemove: feeCopy.customRemove,
                customHint: feeCopy.customHint,
                noPeriods: feeCopy.noPeriods,
                current: plan ? feeCopy.current(plan.version) : feeCopy.none,
              }}
            />
          ) : (
            <div className="space-y-4">
              {initialPeriods.length === 0 ? (
                <p className="rounded-lg border border-eavi-border p-4 text-sm text-eavi-muted-text">
                  {feeCopy.noPeriods}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-eavi-border text-left text-xs uppercase tracking-wide text-eavi-muted-text">
                        <th scope="col" className="py-2 pr-3 font-medium">{feeCopy.periodHeader}</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">{feeCopy.amount} (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialPeriods.map((row, index) => (
                        <tr key={`${row.label}-${index}`} className="border-b border-eavi-border/60">
                          <td className="py-2 pr-3">{row.label}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-sm">
                {feeCopy.total}: <span className="font-semibold tabular-nums">
                  {money(initialPeriods.reduce((sum, row) => sum + Number(row.amount || 0), 0))}
                </span>
                <span className="ml-2 text-xs text-eavi-muted-text">
                  {plan ? feeCopy.current(plan.version) : feeCopy.none}
                </span>
              </p>
            </div>
          )}
        </div>
      </Panel>

      <Panel title={feeCopy.calendarTitle} description={feeCopy.calendarNote}>
        {calendarRows.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{feeCopy.calendarEmpty}</p>
        ) : (
          <DataTable
            columns={feeCopy.calendarColumns as Column[]}
            rows={calendarRows}
            caption={feeCopy.calendarTitle}
          />
        )}
      </Panel>
    </div>
  );
}
