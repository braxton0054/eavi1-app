import { createEvent, createIntake, createTerm, deleteEvent } from "@/lib/actions/college/calendar";
import { getCalendar, getTermOptions } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, formatMonth } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";

const copy = pages.calendar;

const termTone: Record<string, ChipTone> = {
  PLANNED: "info",
  ACTIVE: "success",
  COMPLETED: "neutral",
};

const eventTone: Record<string, ChipTone> = {
  ACADEMIC: "info",
  HOLIDAY: "neutral",
  EXAMINATION: "warning",
  ADMISSION: "info",
  FINANCE: "warning",
  MEETING: "neutral",
};

const monthKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; invalid?: string }>;
}) {
  const { month, invalid } = await searchParams;

  const [calendar, termOptions] = await Promise.all([getCalendar(month), getTermOptions()]);

  const options: OptionSets = { terms: termOptions };

  const previousMonth = new Date(calendar.start.getFullYear(), calendar.start.getMonth() - 1, 1);
  const nextMonth = new Date(calendar.start.getFullYear(), calendar.start.getMonth() + 1, 1);

  const termRows: Row[] = calendar.terms.map((term) => ({
    id: term.id,
    cells: {
      name: term.name,
      window: `${formatDate(term.startDate)}–${formatDate(term.endDate)}`,
      status: (
        <StatusChip tone={termTone[term.status] ?? "neutral"}>
          {labels.termStatus[term.status]}
        </StatusChip>
      ),
      intakes: String(term.intakes.length),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <nav className="flex items-center justify-between gap-3" aria-label={copy.events.heading}>
        <a
          href={`/dashboard/calendar?month=${monthKeyOf(previousMonth)}`}
          aria-label={common.previous}
          className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
        >
          {common.previous}
        </a>
        <p className="text-sm font-medium">{formatMonth(calendar.start)}</p>
        <a
          href={`/dashboard/calendar?month=${monthKeyOf(nextMonth)}`}
          aria-label={common.next}
          className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
        >
          {common.next}
        </a>
      </nav>

      <DisclosureForm
        id="new-event"
        button={copy.events.create.button}
        title={copy.events.create.title}
        fields={copy.events.create.fields}
        options={options}
        action={createEvent}
        submitLabel={common.create}
      />

      <Panel title={copy.terms.heading}>
        {termRows.length === 0 ? (
          <EmptyState body={copy.terms.empty} icon="calendar" />
        ) : (
          <DataTable columns={copy.terms.columns} rows={termRows} caption={copy.terms.heading} />
        )}

        <div className="space-y-4 border-t border-eavi-border p-4">
          <DisclosureForm
            id="new-term"
            button={copy.terms.create.button}
            title={copy.terms.create.title}
            fields={copy.terms.create.fields}
            action={createTerm}
            submitLabel={common.create}
          />
          <DisclosureForm
            id="new-intake"
            button={copy.terms.intake.button}
            title={copy.terms.intake.title}
            fields={copy.terms.intake.fields}
            options={options}
            action={createIntake}
            submitLabel={common.create}
          />
        </div>
      </Panel>

      <Panel title={copy.events.heading}>
        {calendar.events.length === 0 ? (
          <EmptyState body={copy.events.empty} icon="calendar" />
        ) : (
          <ul className="divide-y divide-eavi-border">
            {calendar.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-eavi-muted-text">
                    {formatDate(event.startsAt)}
                    {event.endsAt ? `–${formatDate(event.endsAt)}` : ""} · {event.term.name} ·{" "}
                    {event.campusId === null ? copy.events.collegeWide : copy.events.thisCampus}
                  </p>
                </div>
                <StatusChip tone={eventTone[event.type] ?? "neutral"}>
                  {labels.calendarEventType[event.type]}
                </StatusChip>
                <RowForm
                  id={`remove-event-${event.id}`}
                  button={common.remove}
                  fields={[]}
                  hidden={{ eventId: event.id }}
                  action={deleteEvent}
                  submitLabel={common.remove}
                  tone="danger"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
