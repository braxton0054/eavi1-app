import { getTutorTimetable } from "@/lib/dal/tutor";
import { timetableDays } from "@/lib/dal/college";
import { labels, tutorPortal } from "@/lib/content/dashboard";
import { PageHeader, Panel } from "@/components/dashboard/panel";
import { cleanTime } from "@/lib/format";

const copy = tutorPortal.timetable;

const time = (value: string) => cleanTime(value) ?? value;

export default async function TutorTimetablePage() {
  const { byDay } = await getTutorTimetable();

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <div className="grid gap-4 lg:grid-cols-2">
        {timetableDays.map((day) => {
          const slots = byDay.get(day) ?? [];
          return (
            <Panel key={day} title={labels.weekday[day]}>
              {slots.length === 0 ? (
                <p className="p-4 text-sm text-eavi-muted-text">{copy.emptyDay}</p>
              ) : (
                <ul className="divide-y divide-eavi-border">
                  {slots.map((slot) => (
                    <li key={slot.id} className="flex flex-col gap-1 p-4">
                      <span className="font-medium">
                        {time(slot.startAt)}–{time(slot.endAt)} · {slot.program.name}
                      </span>
                      <span className="text-sm text-eavi-muted-text">{slot.room ?? tutorPortal.home.room}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
