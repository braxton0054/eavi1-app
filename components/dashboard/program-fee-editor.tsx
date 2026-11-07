"use client";

import { useState } from "react";

import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProgramFeePlan } from "@/lib/actions/college/programs";
import {
  draftTotal,
  generatePeriods,
  type FeeKind,
  type PeriodDraft,
} from "@/lib/fees/periods";
import { money } from "@/lib/format";

export type FeeCadenceChoice = { id: string; name: string; kind: FeeKind };

/** Only serializable strings travel to this component; nothing is re-fetched here. */
export type ProgramFeeCopy = {
  cadence: string;
  duration: string;
  durationHint: string;
  note: string;
  amount: string;
  periodHeader: string;
  offsetHeader: string;
  total: string;
  save: string;
  customAdd: string;
  customRemove: string;
  customHint: string;
  noPeriods: string;
  current: string;
};

const selectClass =
  "flex h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/**
 * The fee schedule builder. Rows are generated from the payment method and the programme
 * duration, using the same helper enrolment uses, so what the administrator sees here is
 * exactly the list of periods a student is billed for.
 */
export function ProgramFeeEditor({
  programId,
  cadences,
  initialCadenceId,
  initialDuration,
  initialPeriods,
  semestersPerYear,
  copy,
}: {
  programId: string;
  cadences: FeeCadenceChoice[];
  initialCadenceId: string;
  initialDuration: number;
  initialPeriods: PeriodDraft[];
  semestersPerYear?: number;
  copy: ProgramFeeCopy;
}) {
  const kindOf = (id: string): FeeKind =>
    cadences.find((cadence) => cadence.id === id)?.kind ?? "CUSTOM";

  const [cadenceId, setCadenceId] = useState(initialCadenceId);
  const [duration, setDuration] = useState(String(initialDuration));
  const [rows, setRows] = useState<PeriodDraft[]>(() =>
    initialPeriods.length > 0
      ? initialPeriods
      : generatePeriods(kindOf(initialCadenceId), initialDuration, semestersPerYear),
  );

  const kind = kindOf(cadenceId);
  const total = draftTotal(rows);

  function changeCadence(nextId: string) {
    const nextKind = kindOf(nextId);
    const months = Number(duration) || 1;
    setCadenceId(nextId);
    setRows((previous) => {
      // A custom schedule is typed by hand, so switching to it starts a single blank row
      // rather than relabelling the generated months as custom periods.
      if (nextKind === "CUSTOM") {
        return kind === "CUSTOM" ? previous : generatePeriods("CUSTOM", months, semestersPerYear);
      }
      // Amounts already typed are kept position by position.
      return generatePeriods(nextKind, months, semestersPerYear, previous);
    });
  }

  function changeDuration(value: string) {
    setDuration(value);
    if (kind === "CUSTOM") return;
    setRows((previous) => generatePeriods(kind, Number(value) || 1, semestersPerYear, previous));
  }

  function updateRow(index: number, patch: Partial<PeriodDraft>) {
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        label: `Period ${previous.length + 1}`,
        amount: "",
        yearIndex: null,
        semesterNo: null,
        dueOffsetDays: previous.length * 30,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((previous) => previous.filter((_, position) => position !== index));
  }

  return (
    <form action={saveProgramFeePlan} className="space-y-5">
      <input type="hidden" name="programId" value={programId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-cadence">{copy.cadence}</Label>
          <select
            id="fee-cadence"
            name="cadenceId"
            value={cadenceId}
            onChange={(event) => changeCadence(event.target.value)}
            className={selectClass}
          >
            {cadences.map((cadence) => (
              <option key={cadence.id} value={cadence.id}>
                {cadence.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-duration">{copy.duration}</Label>
          <Input
            id="fee-duration"
            name="durationMonths"
            type="number"
            min={1}
            step={1}
            required
            value={duration}
            onChange={(event) => changeDuration(event.target.value)}
          />
          <p className="text-xs text-eavi-muted-text">{copy.durationHint}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fee-note">{copy.note}</Label>
        <Input id="fee-note" name="note" type="text" maxLength={280} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-eavi-border p-4 text-sm text-eavi-muted-text">
          {copy.noPeriods}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-eavi-border text-left text-xs uppercase tracking-wide text-eavi-muted-text">
                <th scope="col" className="py-2 pr-3 font-medium">{copy.periodHeader}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{copy.amount} (KES)</th>
                {kind === "CUSTOM" ? (
                  <th scope="col" className="py-2 pr-3 font-medium">{copy.offsetHeader}</th>
                ) : null}
                <th scope="col" className="py-2 text-right font-medium">
                  <span className="sr-only">{copy.customRemove}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} className="border-b border-eavi-border/60 align-top">
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`${copy.periodHeader} ${index + 1}`}
                      name="periodLabel"
                      value={row.label}
                      readOnly={kind !== "CUSTOM"}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                    />
                    <input type="hidden" name="periodYear" value={row.yearIndex ?? ""} />
                    <input type="hidden" name="periodSemester" value={row.semesterNo ?? ""} />
                    {kind !== "CUSTOM" ? (
                      <input type="hidden" name="periodOffset" value={row.dueOffsetDays} />
                    ) : null}
                  </td>

                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`${copy.amount} ${index + 1}`}
                      name="periodAmount"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={row.amount}
                      onChange={(event) => updateRow(index, { amount: event.target.value })}
                    />
                  </td>

                  {kind === "CUSTOM" ? (
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`${copy.offsetHeader} ${index + 1}`}
                        name="periodOffset"
                        type="number"
                        min={0}
                        step={1}
                        value={row.dueOffsetDays}
                        onChange={(event) =>
                          updateRow(index, { dueOffsetDays: Number(event.target.value) || 0 })
                        }
                      />
                    </td>
                  ) : null}

                  <td className="py-2 text-right">
                    {kind === "CUSTOM" && rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="min-h-11 rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-destructive"
                      >
                        {copy.customRemove}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kind === "CUSTOM" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text"
          >
            {copy.customAdd}
          </button>
          <p className="text-xs text-eavi-muted-text">{copy.customHint}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-eavi-border pt-4">
        <p className="text-sm">
          {copy.total}:{" "}
          <span className="font-semibold tabular-nums">{money(total)}</span>
          <span className="ml-2 text-xs text-eavi-muted-text">{copy.current}</span>
        </p>
        <ShimmerButton type="submit">{copy.save}</ShimmerButton>
      </div>

    </form>
  );
}
