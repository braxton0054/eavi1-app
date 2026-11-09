import {
  createEvent,
  createIntake,
  createSemester,
  deleteEvent,
  updateSemester,
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

const semesterTone: Record<string, ChipTone> = {
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
  const semesterFields = copy.semesters.create.fields.filter((field) => field.name !== "campusId");
  const intakeFields = copy.semesters.intake.fields.filter((field) => field.name !== "campusId");

  /**
   * Order the year by date, not by slot number: an odd term 1 configuration or a missing
   * semester 2 should still read top to bottom as a timeline.
   */
  const slots = [...view.slots]
    .sort((a, b) => {
      const aStart = a.semester?.startDate.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = b.semester?.startDate.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aStart - bStart || a.semesterNo - b.semesterNo;
    })
    .map((slot) => {
      const semester = slot.semester;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const running =
        !!semester && semester.startDate <= today && semester.endDate >= today;
      const days = running
        ? Math.floor((today.getTime() - semester!.startDate.getTime()) / 86_400_000) + 1
        : null;

      return {
        slot,
        semester,
        days,
        // A stored ACTIVE status is not enough: more than one semester can carry it, so
        // the calendar trusts the dates and treats only the covering window as current.
        phase: !semester
          ? ("none" as const)
          : semester.endDate < today
            ? ("past" as const)
            : semester.startDate > today
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
          id="new-semester"
          button={copy.semesters.create.button}
          title={copy.semesters.create.title}
          fields={semesterFields}
          options={options}
          values={{ year: String(view.year) }}
          // Same rule as the intake form: the campus is the page's, not a third question.
          hidden={{ campusId: String(view.campusId) }}
          action={createSemester}
          submitLabel={common.create}
        />
      ) : null}

      {/*
        Intakes stand on their own, not inside a semester.

        An intake is the thing a student actually joins — January, May or September — and there
        are three a year while admissions run every month. Filing one under a semester made it look
        like calendar decoration and meant a campus could not record a May intake without first
        setting up a semester to hang it on.
      */}
      {view.editable ? (
        <section className="max-w-4xl">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {copy.semesters.intake.button}
          </h2>
          <p className="mt-1 text-sm leading-6 text-eavi-muted-text">{copy.semesters.intake.note}</p>
          {/*
            What has been recorded, so a saved intake is visible on the page it was created from
            rather than living only in the database.
          */}
          {view.standaloneIntakes.length > 0 ? (
            <ul className="mt-3 divide-y divide-eavi-border rounded-2xl border border-eavi-border bg-eavi-card">
              {view.standaloneIntakes.map((intake) => (
                <li
                  key={intake.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="font-medium text-eavi-on-bg">{intake.name}</span>
                  <span className="text-xs text-eavi-muted-text tabular-nums">
                    {formatDate(intake.startsAt)}
                    {intake.endsAt ? ` – ${formatDate(intake.endsAt)}` : ""} ·{" "}
                    {copy.semesters.intakeDeadline} {formatDate(intake.applicationDeadline)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-eavi-muted-text">{copy.semesters.intake.empty}</p>
          )}

          <div className="mt-3">
            <DisclosureForm
              id="new-intake"
              button={copy.semesters.intake.button}
              title={copy.semesters.intake.title}
              fields={intakeFields}
              options={options}
              values={{}}
              // Always the campus being viewed. There is no campus field, so this is the only
              // place the action learns which campus the page is showing.
              hidden={{ campusId: String(view.campusId) }}
              action={createIntake}
              submitLabel={common.create}
            />
          </div>
        </section>
      ) : null}

      {/*
        The year reads as a timeline: semesters in date order, the one running today open,
        the rest folded to a single line. An empty section costs nothing instead of four
        "no events" headings, so a quiet year is short and a busy one is readable.
      */}
      <ol className="max-w-4xl space-y-3">
        {slots.map(({ slot, semester, canEdit, isCurrent, days, phase }) => {
          const semesterCopy = copy.semesters;
          const heading = `${semesterCopy.slot} ${slot.semesterNo} · ${view.year}`;
          const total = semester
            ? semester.intakes.length + semester.exams.length + semester.calendarEvents.length
            : 0;

          return (
            <li key={slot.semesterNo}>
              <details
                open={isCurrent || !semester}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-eavi-card shadow-eavi-card",
                  isCurrent ? "border-eavi-primary-text/60" : "border-eavi-border",
                )}
              >
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="text-sm font-semibold text-eavi-on-bg">{heading}</span>
                    {semester ? (
                      <span className="text-xs text-eavi-muted-text tabular-nums">
                        {formatDate(semester.startDate)} – {formatDate(semester.endDate)}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {phase === "current" ? (
                      <StatusChip tone="success">{semesterCopy.current}</StatusChip>
                    ) : phase === "none" ? (
                      <StatusChip tone="neutral">{semesterCopy.notConfigured}</StatusChip>
                    ) : phase === "past" ? (
                      <StatusChip tone="neutral">{labels.semesterStatus.COMPLETED}</StatusChip>
                    ) : (
                      <StatusChip tone={semesterTone[semester!.status] ?? "neutral"}>
                        {labels.semesterStatus[semester!.status]}
                      </StatusChip>
                    )}
                  </span>
                </summary>

                {!semester ? (
                  <EmptyState body={semesterCopy.notConfigured} icon="calendar" />
                ) : (
                  <div className="space-y-4 border-t border-eavi-border p-4">
                    {/* Where we are in the term, and the one action worth taking here. */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {days !== null ? (
                        <p className="text-sm font-medium text-eavi-on-bg">
                          {semesterCopy.weekOf} {Math.ceil(days / 7)} {semesterCopy.of}{" "}
                          {Math.ceil(
                            (semester.endDate.getTime() - semester.startDate.getTime()) /
                              (7 * 24 * 60 * 60 * 1000),
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-eavi-muted-text">
                          {semesterCopy.endedNote(formatDate(semester.endDate))}
                        </p>
                      )}

                      {canEdit ? (
                        <RowForm
                          id={`edit-semester-${semester.id}`}
                          button={semesterCopy.edit.button}
                          fields={semesterCopy.edit.fields}
                          values={{
                            startDate: toDateInput(semester.startDate),
                            endDate: toDateInput(semester.endDate),
                            status: semester.status,
                          }}
                          hidden={{ semesterId: semester.id }}
                          action={updateSemester}
                          submitLabel={common.save}
                          className="ms-auto"
                        />
                      ) : null}
                    </div>

                    {total === 0 ? (
                      <p className="text-xs text-eavi-muted-text">
                        {semesterCopy.nothingScheduled}
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {semester.intakes.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {semesterCopy.intakesHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {semester.intakes.map((intake) => (
                                <li key={intake.id} className="leading-tight">
                                  <span className="font-medium text-eavi-on-bg">{intake.name}</span>
                                  <span className="block text-xs text-eavi-muted-text">
                                    {semesterCopy.intakeDeadline}{" "}
                                    {formatDate(intake.applicationDeadline)} ·{" "}
                                    {semesterCopy.intakeStarts} {formatDate(intake.commenceAt)}
                                    {intake.endsAt
                                      ? ` · ${semesterCopy.intakeEnds} ${formatDate(intake.endsAt)}`
                                      : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {semester.exams.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {semesterCopy.examsHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {semester.exams.map((exam) => (
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

                        {semester.calendarEvents.length > 0 ? (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-eavi-primary-text uppercase">
                              {semesterCopy.eventsHeading}
                            </h3>
                            <ul className="mt-1 space-y-1.5 text-sm">
                              {semester.calendarEvents.map((event) => (
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
                              {semesterCopy.cardsHeading}
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

                    {/* Adding is only offered on a semester that can still be changed. */}
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2 border-t border-eavi-border pt-3">
                        <RowForm
                          id={`new-intake-${semester.id}`}
                          button={semesterCopy.intake.button}
                          fields={semesterCopy.intake.fields}
                          hidden={{ semesterId: semester.id }}
                          action={createIntake}
                          submitLabel={common.create}
                        />
                        <RowForm
                          id={`new-event-${semester.id}`}
                          button={copy.events.create.button}
                          fields={copy.events.create.fields}
                          hidden={{ semesterId: semester.id }}
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
