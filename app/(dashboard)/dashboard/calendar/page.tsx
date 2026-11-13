import {
  createEvent,
  createPeriod,
  deleteEvent,
  updatePeriod,
} from "@/lib/actions/college/calendar";
import { getCalendar } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Label } from "@/components/ui/label";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const copy = pages.calendar;

const periodTone: Record<string, ChipTone> = {
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
  searchParams: Promise<{
    year?: string;
    campus?: string;
    invalid?: string;
    reason?: string;
  }>;
}) {
  const { year, campus, invalid, reason } = await searchParams;

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
    "h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  /*
   * No campus field on either form, for anyone.
   *
   * Both forms file their record against the campus the page is already showing, which the
   * header picker and the campus links above have already chosen. Offering the campus a third
   * time inside the form invited a record to be filed somewhere other than the page you were
   * looking at — and when the field went in twice the wrong one won, which is how intakes
   * silently stopped being created. One place decides the campus: the page.
   */
  const periodFields = copy.semesters.create.fields.filter((field) => field.name !== "campusId");

  /**
   * The three intake months, ordered as a timeline. Every slot is shown whether or not a period
   * exists for it, so a missing one is visible instead of silently absent.
   */
  const slots = view.slots.map((slot) => {
    const period = slot.period;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const running = !!period && period.startsAt <= today && period.endsAt >= today;
    const days = running
      ? Math.floor((today.getTime() - period!.startsAt.getTime()) / 86_400_000) + 1
      : null;

    return {
      slot,
      period,
      days,
      // A stored ACTIVE status is not enough: more than one period can carry it, so the
      // calendar trusts the dates and treats only the covering window as current.
      phase: !period
        ? ("none" as const)
        : period.endsAt < today
          ? ("past" as const)
          : period.startsAt > today
            ? ("upcoming" as const)
            : ("current" as const),
      isCurrent: running,
      canEdit: view.editable && slot.editable,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? (
        <Notice
          tone="warning"
          title={common.errorTitle}
          // The specific refusal when the action sent one back, so the notice names the field
          // that is wrong instead of telling the admin only that something was.
          body={reason ? decodeURIComponent(reason) : common.invalidSubmit}
        />
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
            <ShimmerButton type="submit" className="shrink-0">
              {copy.year.show}
            </ShimmerButton>
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
          id="new-period"
          button={copy.semesters.create.button}
          title={copy.semesters.create.title}
          fields={periodFields}
          options={options}
          values={{ year: String(view.year) }}
          // The campus is the page's, not a third question.
          hidden={{ campusId: String(view.campusId) }}
          action={createPeriod}
          submitLabel={common.create}
        />
      ) : null}

      {/*
        The year reads as a timeline of the three intake periods. The one running today is open,
        the rest folded to a single line. An empty section costs nothing instead of four
        "no events" headings, so a quiet year is short and a busy one is readable.
      */}
      <ol className="max-w-4xl space-y-3">
        {slots.map(({ slot, period, canEdit, isCurrent, days, phase }) => {
          const periodCopy = copy.semesters;
          const heading = `${slot.label} · ${view.year}`;
          const total = period ? period.exams.length + period.calendarEvents.length : 0;

          return (
            <li key={slot.month}>
              <details
                open={isCurrent || !period}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-eavi-card shadow-eavi-card",
                  isCurrent ? "border-eavi-primary-text/60" : "border-eavi-border",
                )}
              >
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="text-sm font-semibold text-eavi-on-bg">{heading}</span>
                    {period ? (
                      <span className="text-xs text-eavi-muted-text tabular-nums">
                        {formatDate(period.startsAt)} – {formatDate(period.endsAt)}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {phase === "current" ? (
                      <StatusChip tone="success">{periodCopy.current}</StatusChip>
                    ) : phase === "none" ? (
                      <StatusChip tone="neutral">{periodCopy.notConfigured}</StatusChip>
                    ) : phase === "past" ? (
                      <StatusChip tone="neutral">{labels.semesterStatus.COMPLETED}</StatusChip>
                    ) : (
                      <StatusChip tone={periodTone[period!.status] ?? "neutral"}>
                        {labels.semesterStatus[period!.status]}
                      </StatusChip>
                    )}
                  </span>
                </summary>

                {!period ? (
                  <EmptyState body={periodCopy.notConfigured} icon="calendar" />
                ) : (
                  <div className="space-y-4 border-t border-eavi-border p-4">
                    {/* Where we are in the period, and the one action worth taking here. */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {days !== null ? (
                        <p className="text-sm font-medium text-eavi-on-bg">
                          {periodCopy.weekOf} {Math.ceil(days / 7)} {periodCopy.of}{" "}
                          {Math.ceil(
                            (period.endsAt.getTime() - period.startsAt.getTime()) /
                              (7 * 24 * 60 * 60 * 1000),
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-eavi-muted-text">
                          {periodCopy.endedNote(formatDate(period.endsAt))}
                        </p>
                      )}

                      <p className="text-sm text-eavi-muted-text">
                        {periodCopy.intakeDeadline} {formatDate(period.applicationDeadline)}
                      </p>

                      {canEdit ? (
                        <RowForm
                          id={`edit-period-${period.id}`}
                          button={periodCopy.edit.button}
                          fields={periodCopy.edit.fields}
                          values={{
                            startsAt: toDateInput(period.startsAt),
                            endsAt: toDateInput(period.endsAt),
                            applicationDeadline: toDateInput(period.applicationDeadline),
                            status: period.status,
                          }}
                          hidden={{ periodId: period.id }}
                          action={updatePeriod}
                          submitLabel={common.save}
                          className="ms-auto"
                        />
                      ) : null}
                    </div>

                    {total === 0 ? (
                      <p className="text-xs text-eavi-muted-text">{periodCopy.nothingScheduled}</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {period.exams.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {periodCopy.examsHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {period.exams.map((exam) => (
                                <li
                                  key={exam.id}
                                  className="flex items-baseline justify-between gap-3 leading-tight"
                                >
                                  <span className="min-w-0 font-medium text-eavi-on-bg">
                                    {exam.title}
                                  </span>
                                  <span className="shrink-0 text-xs text-eavi-muted-text tabular-nums">
                                    {formatDate(exam.date)} {exam.startAt}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {period.calendarEvents.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {periodCopy.eventsHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {period.calendarEvents.map((event) => (
                                <li
                                  key={event.id}
                                  className="flex items-baseline justify-between gap-3 leading-tight"
                                >
                                  <span className="min-w-0">
                                    <span className="block font-medium text-eavi-on-bg">
                                      {event.title}
                                    </span>
                                    <span className="text-xs text-eavi-muted-text">
                                      {formatDate(event.startsAt)}
                                      {event.endsAt ? `–${formatDate(event.endsAt)}` : ""}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1">
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
                          </section>
                        ) : null}

                        {slot.cards.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {periodCopy.cardsHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {slot.cards.map((card) => (
                                <li
                                  key={card.id}
                                  className="flex items-baseline justify-between gap-3 leading-tight"
                                >
                                  <span className="min-w-0">
                                    <span className="block font-medium text-eavi-on-bg">
                                      {card.student.user.fullName}
                                    </span>
                                    <span className="text-xs text-eavi-muted-text tabular-nums">
                                      {card.serial}
                                    </span>
                                  </span>
                                  <StatusChip tone={cardTone[card.status] ?? "neutral"}>
                                    {labels.cardStatus[card.status]}
                                  </StatusChip>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                    )}

                    {/* Adding is only offered on a period that can still be changed. */}
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2 border-t border-eavi-border pt-3">
                        <RowForm
                          id={`new-event-${period.id}`}
                          button={copy.events.create.button}
                          fields={copy.events.create.fields}
                          hidden={{ periodId: period.id }}
                          action={createEvent}
                          submitLabel={common.create}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ol>

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
                      <span className="block leading-tight font-medium sm:truncate">{event.title}</span>
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
