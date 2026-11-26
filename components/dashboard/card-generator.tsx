"use client";

import { useState } from "react";

import { generateCards } from "@/lib/actions/college/card-generation";
import { SubmitButton } from "@/components/dashboard/submit-button";
import type { Choice } from "@/components/dashboard/record-form";
import { pages } from "@/lib/content/dashboard";

type Candidate = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  programName: string | null;
  intakeLabel: string | null;
  classLabel: string | null;
  hasPhoto: boolean;
};

const copy = pages.cards.generate;

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-eavi-text">{label}</span>
      {children}
    </label>
  );
}

/**
 * Chooses who a print run covers.
 *
 * The count is shown before the PDF is built, because the expensive mistakes with ID cards
 * are printing the wrong set and printing too many — both are invisible until the plastic
 * comes out.
 */
export function CardGenerator({
  students,
  classes,
  intakes,
  candidatesByTarget,
}: {
  students: Choice[];
  classes: Choice[];
  intakes: Choice[];
  candidatesByTarget: Record<string, Candidate[]>;
}) {
  const [kind, setKind] = useState<"student" | "class" | "intake">("class");
  const [choice, setChoice] = useState<string>("");

  const key = choice ? `${kind}:${choice}` : "";
  const candidates = key ? (candidatesByTarget[key] ?? []) : [];

  const options = kind === "student" ? students : kind === "class" ? classes : intakes;

  return (
    <form action={generateCards} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-eavi-text">{copy.targetLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {(["student", "class", "intake"] as const).map((value) => (
            <label
              key={value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-eavi-border px-3 text-sm has-checked:border-eavi-primary has-checked:bg-eavi-primary-soft"
            >
              <input
                type="radio"
                name="targetKind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setChoice("");
                }}
                className="size-4 accent-eavi-primary"
              />
              {copy.kinds[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={
          kind === "student" ? copy.studentLabel : kind === "class" ? copy.classLabel : copy.intakeLabel
        }
      >
        <select
          name={kind === "student" ? "studentId" : kind === "class" ? "classId" : "intakeId"}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={selectCls}
          required
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {choice ? (
        candidates.length === 0 ? (
          <p className="text-sm text-eavi-muted-text">{copy.previewEmpty}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.preview(candidates.length)}</p>
            <ul className="max-h-64 divide-y divide-eavi-border overflow-y-auto rounded-xl border border-eavi-border text-sm">
              {candidates.map((candidate) => (
                <li key={candidate.studentId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-2.5">
                  <span className="font-medium tabular-nums">{candidate.admissionNo}</span>
                  <span className="min-w-0">{candidate.fullName}</span>
                  <span className="ms-auto text-xs text-eavi-muted-text">
                    {[candidate.programName, candidate.classLabel, candidate.intakeLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {candidate.hasPhoto ? null : (
                    <span className="text-xs text-eavi-destructive">{copy.noPhoto}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <p className="text-sm text-eavi-muted-text">{copy.previewEmpty}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={copy.button} disabled={!choice || candidates.length === 0} />
      </div>
    </form>
  );
}
