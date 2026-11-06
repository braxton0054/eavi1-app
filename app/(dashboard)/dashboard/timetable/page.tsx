import { createSlot, deleteSlot } from "@/lib/actions/college/timetable";
import { getProgramOptions, getTimetable, getTutorOptions, timetableDays } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages, shell } from "@/lib/content/dashboard";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { cleanTime } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.timetable;

/** Slots store validated "HH:mm" strings; the fallback only narrows the formatter. */
const time = (value: string) => cleanTime(value) ?? value;

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [{ byDay }, programOptions, tutorOptions] = await Promise.all([
    getTimetable(),
    getProgramOptions(scope.campusId),
    getTutorOptions(scope.campusId),
  ]);

  const options: OptionSets = { programs: programOptions, tutors: tutorOptions };

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      {scope.campusId !== null ? (
        <DisclosureForm
          id="new-slot"
          button={copy.create.button}
          title={copy.create.title}
          fields={copy.create.fields}
          options={options}
          action={createSlot}
          submitLabel={common.create}
        />
      ) : (
        <Notice tone="neutral" title={copy.create.button} body={shell.chooseCampus} />
      )}

      {/* One column on phones, two from lg up: a week reads top-to-bottom at 375px. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {timetableDays.map((day) => {
          const slots = [...(byDay.get(day) ?? [])].sort((a, b) =>
            a.startAt.localeCompare(b.startAt),
          );
          return (
            <Panel key={day} title={labels.weekday[day]}>
              {slots.length === 0 ? (
                <p className="p-4 text-sm text-eavi-muted-text">{copy.emptyDay}</p>
              ) : (
                <ul className="divide-y divide-eavi-border">
                  {slots.map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                      <p className="text-sm font-medium tabular-nums">
                        {time(slot.startAt)}–{time(slot.endAt)}
                      </p>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight sm:truncate">
                          {slot.program.code} · {slot.program.name}
                        </p>
                        <p className="text-xs text-eavi-muted-text">
                          {slot.tutor?.user.fullName ?? copy.unassignedTutor} ·{" "}
                          {slot.room ?? common.notSet}
                          {slot.weekOffsetLabel ? ` · ${slot.weekOffsetLabel}` : ""}
                        </p>
                      </div>
                      <RowForm
                        id={`remove-slot-${slot.id}`}
                        button={common.remove}
                        fields={[]}
                        hidden={{ slotId: slot.id }}
                        action={deleteSlot}
                        submitLabel={common.remove}
                        tone="danger"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>

      <p className="text-sm text-eavi-muted-text">{copy.conflict}</p>
    </div>
  );
}
