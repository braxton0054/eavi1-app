import {
  createEvent,
  createIntake,
  createTerm,
  deleteEvent,
  updateTerm,
} from "@/lib/actions/college/calendar";
import { getCalendar } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, toDateInput } from "@/lib/format";


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

const cardTone: Record<string, ChipTone> = {
  PENDING: "info",
  PRINTING: "warning",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "neutral",
};

/** A term normally runs one of each, but any number of sittings of either type is allowed. */
const EXAM_TYPES = ["CAT", "END_TERM"] as const;

/** The year step control: a link while the window has road left, a plain label when it does not. */
function StepLink({
  href,
  label,
  ariaLabel,
}: {
  href: string | null;
  label: string;
  ariaLabel: string;
}) {
  const className =
    "inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium";

  return href ? (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`${className} text-eavi-primary-text hover:bg-eavi-muted`}
    >
      {label}
    </a>
  ) : (
    <span aria-disabled="true" aria-label={ariaLabel} className={`${className} opacity-50`}>
      {label}
    </span>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; campus?: string; invalid?: string }>;
}) {
  const { year, campus, invalid } = await searchParams;

  const view = await getCalendar(year, campus);
  const collegeAdmin = view.campuses.length > 0;

  // Every link has to keep the campus a super admin chose, or the next read falls back to
  // the first campus in the list.
  const link = (nextYear: number) =>
    `/dashboard/calendar?year=${nextYear}${collegeAdmin ? `&campus=${view.campusId}` : ""}`;

  const options: OptionSets = {
    years: view.openYears.map((value) => ({ value: String(value), label: String(value) })),
    campuses: view.campuses,
  };

  const choiceClass =
    "h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  // A campus admin is pinned to their own campus, so the campus select is not offered.
  const termFields = copy.terms.create.fields.filter(
    (field) => field.name !== "campusId" || collegeAdmin,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      {invalid ? (
        <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} />
      ) : null}

      {collegeAdmin ? (
        <nav className="flex flex-wrap items-center gap-2" aria-label={copy.campus.select}>
          {view.campuses.map((choice) => (
            <a
              key={choice.value}
              href={`/dashboard/calendar?campus=${choice.value}&year=${view.year}`}
              aria-current={Number(choice.value) === view.campusId ? "true" : undefined}
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted aria-[current=true]:bg-eavi-primary-soft"
            >
              {choice.label}
            </a>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="text-sm font-semibold">
          {copy.year.heading} {view.year}
        </p>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <StepLink
            href={view.canPrevious ? link(view.year - 1) : null}
            label={common.previous}
            ariaLabel={copy.year.previous}
          />

          <form action="/dashboard/calendar" method="get" className="flex items-center gap-2">
            {collegeAdmin ? <input type="hidden" name="campus" value={view.campusId} /> : null}
            <Label htmlFor="calendar-year" className="sr-only">
              {copy.year.select}
            </Label>
            <select
              id="calendar-year"
              name="year"
              defaultValue={String(view.year)}
              className={choiceClass}
            >
              {view.years.map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </select>
            <Button type="submit">{copy.year.show}</Button>
          </form>

          <StepLink
            href={view.canNext ? link(view.year + 1) : null}
            label={common.next}
            ariaLabel={copy.year.next}
          />
        </div>
      </div>

      {view.editable ? null : (
        <Notice
          tone="neutral"
          title={copy.year.closedTitle}
          body={copy.year.closedBody(view.year)}
        />
      )}

      {view.editable ? (
        <DisclosureForm
          id="new-term"
          button={copy.terms.create.button}
          title={copy.terms.create.title}
          fields={termFields}
          options={options}
          values={{ year: String(view.year) }}
          action={createTerm}
          submitLabel={common.create}
        />
      ) : null}

      {view.slots.map((slot) => {
        const term = slot.term;
        const heading = `${copy.terms.slot} ${slot.termNo} · ${view.year}`;
        const canEdit = view.editable && slot.editable;

        return (
          <Panel key={slot.termNo} title={heading}>
            {!term ? (
              <EmptyState body={copy.terms.notConfigured} icon="calendar" />
            ) : (
              <div className="space-y-5 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="text-sm font-medium">
                    {copy.terms.window} {formatDate(term.startDate)} {copy.terms.through}{" "}
                    {formatDate(term.endDate)}
                  </p>
                  <StatusChip tone={termTone[term.status] ?? "neutral"}>
                    {labels.termStatus[term.status]}
                  </StatusChip>
                  {canEdit ? (
                    <RowForm
                      id={`edit-term-${term.id}`}
                      button={copy.terms.edit.button}
                      fields={copy.terms.edit.fields}
                      values={{
                        startDate: toDateInput(term.startDate),
                        endDate: toDateInput(term.endDate),
                        status: term.status,
                      }}
                      hidden={{ termId: term.id }}
                      action={updateTerm}
                      submitLabel={common.save}
                    />
                  ) : (
                    <p className="text-xs text-eavi-muted-text">
                      {copy.terms.endedNote(formatDate(term.endDate))}
                    </p>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <section>
                    <h3 className="text-sm font-semibold">{copy.terms.intakesHeading}</h3>
                    {term.intakes.length === 0 ? (
                      <p className="mt-1 text-xs text-eavi-muted-text">{copy.terms.emptyIntakes}</p>
                    ) : (
                      <ul className="mt-1 divide-y divide-eavi-border text-sm">
                        {term.intakes.map((intake) => (
                          <li key={intake.id} className="py-2">
                            <p className="font-medium">{intake.name}</p>
                            <p className="text-xs text-eavi-muted-text">
                              {formatDate(intake.applicationDeadline)} · {formatDate(intake.commenceAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canEdit ? (
                      <RowForm
                        id={`new-intake-${term.id}`}
                        button={copy.terms.intake.button}
                        fields={copy.terms.intake.fields}
                        hidden={{ termId: term.id }}
                        action={createIntake}
                        submitLabel={common.create}
                      />
                    ) : null}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">{copy.terms.examsHeading}</h3>
                    {term.exams.length === 0 ? (
                      <p className="mt-1 text-xs text-eavi-muted-text">{copy.terms.emptyExams}</p>
                    ) : (
                      <div className="mt-1 space-y-3">
                        {EXAM_TYPES.map((type) => {
                          const papers = term.exams.filter((exam) => exam.type === type);
                          if (papers.length === 0) return null;

                          return (
                            <div key={type}>
                              <p className="text-xs font-semibold uppercase tracking-wider text-eavi-primary-text">
                                {labels.examType[type]}
                              </p>
                              <ul className="divide-y divide-eavi-border text-sm">
                                {papers.map((exam) => (
                                  <li
                                    key={exam.id}
                                    className="flex items-center justify-between gap-3 py-2"
                                  >
                                    <span className="min-w-0 truncate font-medium">{exam.title}</span>
                                    <span className="shrink-0 text-xs text-eavi-muted-text">
                                      {formatDate(exam.date)} {exam.startAt}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">{copy.terms.cardsHeading}</h3>
                    {slot.cards.length === 0 ? (
                      <p className="mt-1 text-xs text-eavi-muted-text">{copy.terms.emptyCards}</p>
                    ) : (
                      <ul className="mt-1 divide-y divide-eavi-border text-sm">
                        {slot.cards.map((card) => (
                          <li key={card.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0 truncate">
                              {card.student.user.fullName}
                              <span className="text-xs text-eavi-muted-text"> · {card.serial}</span>
                            </span>
                            <StatusChip tone={cardTone[card.status] ?? "neutral"}>
                              {labels.cardStatus[card.status]}
                            </StatusChip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">{copy.terms.eventsHeading}</h3>
                    {term.calendarEvents.length === 0 ? (
                      <p className="mt-1 text-xs text-eavi-muted-text">{copy.terms.emptyEvents}</p>
                    ) : (
                      <ul className="mt-1 divide-y divide-eavi-border text-sm">
                        {term.calendarEvents.map((event) => (
                          <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{event.title}</span>
                              <span className="text-xs text-eavi-muted-text">
                                {formatDate(event.startsAt)}
                                {event.endsAt ? `–${formatDate(event.endsAt)}` : ""}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <StatusChip tone={eventTone[event.type] ?? "neutral"}>
                                {labels.calendarEventType[event.type]}
                              </StatusChip>
                              {canEdit ? (
                                <RowForm
                                  id={`remove-event-${event.id}`}
                                  button={common.remove}
                                  fields={[]}
                                  hidden={{ eventId: event.id }}
                                  action={deleteEvent}
                                  submitLabel={common.remove}
                                  tone="danger"
                                />
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canEdit ? (
                      <RowForm
                        id={`new-event-${term.id}`}
                        button={copy.events.create.button}
                        fields={copy.events.create.fields}
                        hidden={{ termId: term.id }}
                        action={createEvent}
                        submitLabel={common.create}
                      />
                    ) : null}
                  </section>
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      {collegeAdmin ? (
        <Panel title={copy.events.college.heading}>
          <div className="space-y-4 p-4">
            {view.collegeEvents.length === 0 ? (
              <p className="text-xs text-eavi-muted-text">{copy.events.college.empty}</p>
            ) : (
              <ul className="divide-y divide-eavi-border text-sm">
                {view.collegeEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{event.title}</span>
                      <span className="text-xs text-eavi-muted-text">
                        {formatDate(event.startsAt)} · {copy.events.collegeWide}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusChip tone={eventTone[event.type] ?? "neutral"}>
                        {labels.calendarEventType[event.type]}
                      </StatusChip>
                      <RowForm
                        id={`remove-college-event-${event.id}`}
                        button={common.remove}
                        fields={[]}
                        hidden={{ eventId: event.id }}
                        action={deleteEvent}
                        submitLabel={common.remove}
                        tone="danger"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <RowForm
              id="new-college-event"
              button={copy.events.college.button}
              fields={copy.events.college.fields}
              action={createEvent}
              submitLabel={common.create}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
