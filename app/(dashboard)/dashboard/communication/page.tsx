import { publishAnnouncement, withdrawAnnouncement } from "@/lib/actions/college/communication";
import { getAnnouncements } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";


const copy = pages.communication;

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const notices = await getAnnouncements();

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-notice"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={{}}
        action={publishAnnouncement}
        submitLabel={common.create}
      />

      <Panel title={copy.title}>
        {notices.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="communication" />
        ) : (
          <ul className="divide-y divide-eavi-border">
            {notices.map((notice) => {
              // A campus admin may only withdraw a notice carrying their own campusId;
              // a college-wide notice belongs to every campus, so only a super admin
              // may remove it.
              const removable = scope.role === "SUPERADMIN" || notice.campusId === scope.campusId;

              return (
                <li key={notice.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{notice.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-eavi-muted-text">{notice.body}</p>
                    </div>
                    {notice.pinned ? <StatusChip tone="info">{copy.pinned}</StatusChip> : null}
                    <StatusChip tone="neutral">{labels.audience[notice.audience]}</StatusChip>
                  </div>

                  <p className="mt-2 text-xs text-eavi-muted-text">
                    {notice.campusId === null ? copy.scopeCollege : copy.scopeCampus} ·{" "}
                    {copy.publishedOn} {formatDate(notice.publishedAt)} · {copy.author}{" "}
                    {notice.author?.fullName ?? common.notSet}
                  </p>

                  {removable ? (
                    <div className="mt-3">
                      <RowForm
                        id={`withdraw-${notice.id}`}
                        button={copy.remove.button}
                        fields={[]}
                        hidden={{ announcementId: notice.id }}
                        action={withdrawAnnouncement}
                        submitLabel={copy.remove.button}
                        tone="danger"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}