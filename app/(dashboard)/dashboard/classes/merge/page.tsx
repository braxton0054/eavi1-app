import Link from "next/link";

import { mergeClasses } from "@/lib/actions/college/classes";
import { getClasses, getMergePreview, mergeSummary } from "@/lib/dal/classes";
import { requireCollegeAdmin } from "@/lib/session";
import { pages } from "@/lib/content/dashboard";
import { Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { SubmitButton } from "@/components/dashboard/submit-button";

const copy = pages.classes.merge;

export default async function MergeClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; target?: string }>;
}) {
  const { source: sourceId, target: targetId } = await searchParams;
  await requireCollegeAdmin();

  const rows = await getClasses();
  const active = rows.filter((row) => row.status === "ACTIVE");

  // The preview is only built once both classes are chosen, so nothing is assumed.
  const preview = sourceId && targetId ? await getMergePreview(sourceId, targetId) : null;
  const blocked = preview ? preview.blockers.length > 0 : false;

  const selectClass =
    "flex min-h-11 w-full min-w-0 truncate rounded-lg border border-input bg-eavi-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <Link
            href="/dashboard/classes"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            All classes
          </Link>
        }
      />

      {/* Choosing the two classes is a GET so the preview can be bookmarked and reloaded. */}
      <Panel>
        <form method="get" className="space-y-4 p-4 sm:p-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0 space-y-1.5">
              <span className="text-sm font-medium">{copy.source}</span>
              <select name="source" defaultValue={sourceId ?? ""} required className={selectClass}>
                <option value="">—</option>
                {active.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.programCode} · {row.students} students
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 space-y-1.5">
              <span className="text-sm font-medium">{copy.target}</span>
              <select name="target" defaultValue={targetId ?? ""} required className={selectClass}>
                <option value="">—</option>
                {active.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.programCode} · {row.students} students
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {copy.preview}
          </button>
        </form>
      </Panel>

      {preview && (
        <>
          {blocked ? (
            <Notice
              tone="warning"
              title={copy.blockedTitle}
              body={preview.blockers.map((blocker) => blocker.message).join(" ")}
            />
          ) : (
            <>
              <Panel>
                <div className="space-y-4 p-4 sm:p-6">
                  <h2 className="text-base font-semibold break-words">{mergeSummary(preview)}</h2>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-eavi-muted-text uppercase">
                        {copy.source}
                      </dt>
                      <dd className="text-sm">
                        {preview.source.name} · {preview.students}{" "}
                        {preview.students === 1 ? "student" : "students"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium tracking-wide text-eavi-muted-text uppercase">
                        {copy.target}
                      </dt>
                      <dd className="text-sm">{preview.target.name}</dd>
                    </div>
                  </dl>

                  {preview.placements.length > 0 && (
                    <div>
                      <p className="text-xs font-medium tracking-wide text-eavi-muted-text uppercase">
                        {copy.placementsTitle}
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {preview.placements.map((row) => (
                          <li
                            key={row.placement}
                            className="rounded-full border border-eavi-border px-3 py-1 text-sm"
                          >
                            {row.placement} · {row.students}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <ul className="space-y-1 text-sm text-eavi-muted-text">
                    {preview.alreadyInTarget > 0 && <li>· {copy.alreadyInTarget(preview.alreadyInTarget)}</li>}
                    {preview.historicalMemberships > 0 && (
                      <li>· {copy.historyNote(preview.historicalMemberships)}</li>
                    )}
                    {preview.notices.map((notice) => (
                      <li key={notice}>· {notice}</li>
                    ))}
                  </ul>
                </div>
              </Panel>

              {preview.students === 0 ? (
                <Notice tone="neutral" title={copy.noStudents} body={copy.description} />
              ) : (
                <Panel>
                  <form action={mergeClasses} className="space-y-4 p-4 sm:p-6">
                    <input type="hidden" name="sourceId" value={preview.source.id} />
                    <input type="hidden" name="targetId" value={preview.target.id} />
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="confirm"
                        value="yes"
                        required
                        className="mt-1 size-5 shrink-0 accent-eavi-fill"
                      />
                      <span>{copy.confirm}</span>
                    </label>
                    <SubmitButton label={copy.confirmButton} />
                  </form>
                </Panel>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
