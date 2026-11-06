import { setStaffStatus } from "@/lib/actions/college/staff";
import { getStaffAccounts } from "@/lib/dal/admin";
import { requireSuperAdmin } from "@/lib/session";
import { common, labels, pages, roles } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.staff;

const accountTone: Record<string, ChipTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  DISABLED: "neutral",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireSuperAdmin();

  const accounts = await getStaffAccounts();

  const rows: Row[] = accounts.map((account) => {
    const isSelf = account.id === scope.userId;
    const nextStatus = account.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

    return {
      id: account.id,
      cells: {
        name: (
          <span className="flex flex-col">
            <span>{account.fullName}</span>
            <span className="text-xs text-eavi-muted-text">{account.email}</span>
          </span>
        ),
        role: roles[account.role],
        campus: account.campus?.name ?? common.notSet,
        record: account.tutor
          ? `${account.tutor.staffNo}${account.tutor.department ? ` · ${account.tutor.department}` : ""}`
          : copy.noRecord,
        status: (
          <StatusChip tone={accountTone[account.status] ?? "neutral"}>
            {labels.userStatus[account.status]}
          </StatusChip>
        ),
        actions: isSelf ? (
          <span className="text-xs text-eavi-muted-text">{copy.ownAccount}</span>
        ) : (
          <RowForm
            id={`staff-${account.id}-status`}
            button={account.status === "ACTIVE" ? copy.disable : copy.approve}
            fields={[]}
            hidden={{ userId: account.id, status: nextStatus }}
            action={setStaffStatus}
            submitLabel={account.status === "ACTIVE" ? copy.disable : copy.approve}
            tone={account.status === "ACTIVE" ? "danger" : "neutral"}
          />
        ),
      },
    };
  });

  const columns: Column[] = copy.columns;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <Panel title={copy.heading}>
        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="tutors" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={copy.heading} />
        )}
      </Panel>
    </div>
  );
}
