import Link from "next/link";

import { createClass } from "@/lib/actions/college/classes";
import { getIntakeChoices } from "@/lib/dal/classes";
import { getProgramOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { pages } from "@/lib/content/dashboard";
import { RecordForm } from "@/components/dashboard/record-form";
import { Notice, PageHeader, Panel } from "@/components/dashboard/panel";

const copy = pages.classes;

export default async function NewClassPage() {
  const scope = await requireCollegeAdmin();

  const [programs, intakes] = await Promise.all([
    getProgramOptions(scope.campusId),
    getIntakeChoices(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={copy.create.title}
        description={copy.create.description}
        action={
          <Link
            href="/dashboard/classes"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            Back to classes
          </Link>
        }
      />

      {scope.campusId === null ? (
        <Notice tone="neutral" title={copy.create.title} body={copy.create.nameHint} />
      ) : intakes.length === 0 ? (
        <Notice tone="warning" title={copy.empty.title} body={copy.officialMonthsOnly} />
      ) : (
        <Panel>
          <div className="p-4 sm:p-6">
            <p className="mb-4 rounded-lg border border-eavi-border bg-eavi-muted/50 p-3 text-sm text-eavi-muted-text">
              {copy.create.nameHint}
            </p>
            <RecordForm
              id="new-class"
              fields={[
                {
                  name: "programId",
                  label: copy.fields.program,
                  type: "select",
                  required: true,
                  optionKey: "programs",
                },
                {
                  name: "intakeId",
                  label: copy.fields.intake,
                  type: "select",
                  required: true,
                  optionKey: "intakes",
                },
                {
                  name: "name",
                  label: copy.fields.name,
                  type: "text",
                  required: true,
                  placeholder: "ICT/JAN/2027",
                },
                { name: "note", label: copy.fields.note, type: "textarea", placeholder: "Optional" },
              ]}
              options={{
                programs,
                intakes: intakes.map((intake) => ({
                  value: intake.id,
                  label: `${intake.label} · ${intake.officialMonth.toLowerCase()}`,
                })),
              }}
              action={createClass}
              submitLabel={copy.create.button}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}
