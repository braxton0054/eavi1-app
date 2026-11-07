import Link from "next/link";
import { notFound } from "next/navigation";

import { moveStudent } from "@/lib/actions/college/classes";
import { getClassHistory, getClassMembers, getClasses } from "@/lib/dal/classes";
import { listAudit } from "@/lib/academics/audit";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { pages } from "@/lib/content/dashboard";
import { RecordForm } from "@/components/dashboard/record-form";
import { DetailList, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";

const copy = pages.classes;

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ merged?: string }>;
}) {
  const { id } = await params;
  const { merged } = await searchParams;
  const scope = await requireCollegeAdmin();

  const klass = await prisma.academicClass.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: {
      id: true,
      name: true,
      note: true,
      year: true,
      status: true,
      intakeMonth: true,
      programId: true,
      intakeId: true,
      program: { select: { name: true, code: true, structure: true } },
      campus: { select: { name: true } },
      intake: { select: { name: true, year: true } },
    },
  });
  if (!klass) notFound();

  const [members, history, audit, siblings] = await Promise.all([
    getClassMembers(klass.id),
    getClassHistory(klass.id),
    listAudit("class", klass.id, 8),
    // Only classes of the same programme can receive a student from here.
    getClasses({ programId: klass.programId }),
  ]);

  const otherClasses = siblings.filter((row) => row.id !== klass.id && row.status === "ACTIVE");

  const stages = [...new Set(members.map((member) => member.placement))];
  const mixed = stages.length > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={klass.name}
        description={`${klass.program.name} · ${klass.intake.name} ${klass.intake.year} · ${klass.campus.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/classes"
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
            >
              All classes
            </Link>
            {otherClasses.length > 0 && (
              <Link
                href={`/dashboard/classes/merge?source=${klass.id}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
              >
                {copy.merge.button}
              </Link>
            )}
          </div>
        }
      />

      {merged === "1" && <Notice tone="success" title={copy.detail.merged} body={copy.merge.done} />}

      <Panel>
        <DetailList
          items={[
            { label: copy.fields.program, value: `${klass.program.code} · ${klass.program.name}` },
            { label: copy.fields.intake, value: `${klass.intake.name} · ${klass.intake.year}` },
            { label: copy.fields.year, value: String(klass.year) },
            {
              label: copy.card.students,
              value: <StatusChip tone={klass.status === "ACTIVE" ? "success" : "neutral"}>{klass.status === "ACTIVE" ? `${members.length} active` : copy.card.archived}</StatusChip>,
            },
            { label: copy.card.placements, value: mixed ? stages.join(" · ") : (stages[0] ?? copy.card.noStudents) },
            ...(klass.note ? [{ label: copy.fields.note, value: klass.note }] : []),
          ]}
        />
      </Panel>

      {mixed && (
        <Notice tone="neutral" title={copy.detail.placementsNote} body={copy.detail.moveHint} />
      )}

      <Panel>
        <div className="border-b border-eavi-border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{copy.detail.membersTitle}</h2>
          <p className="mt-1 text-sm text-eavi-muted-text">
            {members.length} {members.length === 1 ? copy.card.student : copy.card.students}
          </p>
        </div>

        {members.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text sm:p-6">{copy.detail.membersEmpty}</p>
        ) : (
          <ul className="divide-y divide-eavi-border">
            {members.map((member) => (
              <li key={member.enrollmentId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/students/${member.studentId}`}
                    className="font-medium text-eavi-primary-text underline-offset-4 hover:underline"
                  >
                    {member.name}
                  </Link>
                  <p className="text-sm text-eavi-muted-text">
                    {member.admissionNo} · {member.intakeName}
                  </p>
                  <p className="text-xs text-eavi-muted-text">
                    Admitted {member.admissionDate ? formatDate(member.admissionDate) : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* The stage is the student's own; the class never overrides it. */}
                  <StatusChip tone="info">{member.placement}</StatusChip>
                  {member.owes > 0 && <StatusChip tone="warning">Owes {member.owes.toLocaleString()}</StatusChip>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {otherClasses.length > 0 && members.length > 0 && (
        <Panel>
          <div className="border-b border-eavi-border p-4 sm:p-6">
            <h2 className="text-base font-semibold">{copy.detail.moveTitle}</h2>
            <p className="mt-1 text-sm text-eavi-muted-text">{copy.detail.moveHint}</p>
          </div>
          <div className="p-4 sm:p-6">
            <RecordForm
              id="move-student"
              fields={[
                {
                  name: "enrollmentId",
                  label: "Student",
                  type: "select",
                  required: true,
                  optionKey: "students",
                },
                {
                  name: "classId",
                  label: copy.fields.class,
                  type: "select",
                  optionKey: "classes",
                },
              ]}
              options={{
                students: members.map((member) => ({
                  value: member.enrollmentId,
                  label: `${member.name} · ${member.admissionNo} · ${member.placement}`,
                })),
                classes: otherClasses.map((row) => ({
                  value: row.id,
                  label: `${row.name} · ${row.intakeName}`,
                })),
              }}
              action={moveStudent}
              submitLabel={copy.detail.moveTitle}
            />
          </div>
        </Panel>
      )}

      <Panel>
        <div className="border-b border-eavi-border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{copy.detail.historyTitle}</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text sm:p-6">{copy.detail.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-eavi-border">
            {history.map((row, index) => (
              <li key={`${row.student}-${index}`} className="p-4 text-sm sm:p-6">
                <p className="font-medium">{row.student}</p>
                <p className="text-eavi-muted-text">
                  {formatDate(row.joinedAt)} – {row.leftAt ? formatDate(row.leftAt) : "—"}
                  {row.reason ? ` · ${row.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {audit.length > 0 && (
        <Panel>
          <div className="border-b border-eavi-border p-4 sm:p-6">
            <h2 className="text-base font-semibold">{copy.detail.auditTitle}</h2>
          </div>
          <ul className="divide-y divide-eavi-border">
            {audit.map((row) => (
              <li key={row.id} className="p-4 text-sm sm:p-6">
                <p className="font-medium">{row.action}</p>
                <p className="text-eavi-muted-text">
                  {formatDate(row.createdAt)} · {row.actorEmail ?? "system"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
