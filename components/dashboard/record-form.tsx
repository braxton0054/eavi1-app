import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { common } from "@/lib/content/dashboard";
import type { Field } from "@/lib/content/dashboard";
import { cn } from "@/lib/utils";

export type Choice = { value: string; label: string };
export type OptionSets = Partial<Record<NonNullable<Field["optionKey"]>, Choice[]>>;
export type FormAction = (formData: FormData) => Promise<void>;

const control =
  "flex h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm";

function Control({
  field,
  htmlId,
  options,
  value,
}: {
  field: Field;
  htmlId: string;
  options: OptionSets;
  value?: string;
}) {
  const choices = field.options ?? (field.optionKey ? (options[field.optionKey] ?? []) : []);

  if (field.type === "select") {
    // FRM-03/40: a list longer than seven options must be searchable — type to filter
    // AND scroll. Short lists stay on the plain select, which is one tap on mobile.
    if (choices.length > 7) {
      return (
        <SearchableSelect
          id={htmlId}
          name={field.name}
          options={choices}
          defaultValue={value}
          placeholder={field.placeholder ?? "Search…"}
          required={field.required}
        />
      );
    }
    // 2–4 choices are shown as radios, not buried in a dropdown (FRM-11).
    if (choices.length >= 2 && choices.length <= 4) {
      return (
        <fieldset id={htmlId} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          <legend className="sr-only">{field.label}</legend>
          {!field.required ? (
            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.name}
                value=""
                defaultChecked={!value}
                className="size-5 accent-eavi-fill"
              />
              <span>{common.none}</span>
            </label>
          ) : null}
          {choices.map((choice) => (
            <label key={choice.value} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.name}
                value={choice.value}
                defaultChecked={value === choice.value}
                className="size-5 accent-eavi-fill"
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    return (
      <select
        id={htmlId}
        name={field.name}
        required={field.required}
        defaultValue={value}
        className={cn(control, "appearance-none bg-eavi-card")}
      >
        {field.required
          ? field.placeholder
            ? <option value="" disabled>{field.placeholder}</option>
            : null
          : <option value="">{common.none}</option>}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiselect") {
    // Several values travel under the same field name; the action reads getAll().
    const chosen = new Set((value ?? "").split(",").filter(Boolean));
    return (
      <select
        id={htmlId}
        name={field.name}
        multiple
        size={Math.min(Math.max(choices.length, 2), 5)}
        required={field.required}
        defaultValue={[...chosen]}
        className={cn(control, "h-auto min-h-11 py-1")}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea id={htmlId} name={field.name} required={field.required} defaultValue={value} placeholder={field.placeholder} rows={4} className={control} />
    );
  }

  if (field.type === "checkbox") {
    return (
      <label htmlFor={htmlId} className="flex h-11 items-center gap-2 text-sm">
        <input
          id={htmlId}
          name={field.name}
          type="checkbox"
          value="yes"
          defaultChecked={value === "yes"}
          className="size-5 accent-eavi-fill"
        />
        <span className="text-eavi-muted-text">{common.yes}</span>
      </label>
    );
  }

  if (field.type === "file") {
    // A file input cannot be pre-filled by a browser, so an edit shows the current
    // filename as text and only replaces it when a new one is picked.
    return (
      <input
        id={htmlId}
        name={field.name}
        type="file"
        accept={field.accept}
        required={field.required}
        className={cn(control, "text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1 file:text-eavi-primary-text")}
      />
    );
  }

  return (
    <Input
      id={htmlId}
      name={field.name}
      type={field.type}
      required={field.required}
      step={field.step}
      placeholder={field.placeholder}
      defaultValue={value}
    />
  );
}

export function RecordForm({
  id,
  fields,
  options,
  values,
  action,
  submitLabel,
  aside,
  hidden,
  compact,
}: {
  id: string;
  fields: readonly Field[];
  options?: OptionSets;
  values?: Record<string, string | undefined>;
  action: FormAction;
  submitLabel: string;
  aside?: ReactNode;
  /** Ids the form must carry but the administrator should not edit. */
  hidden?: Record<string, string>;
  /** @deprecated All forms are single-column now; kept so existing callers compile. */
  compact?: boolean;
}) {
  void compact; // accepted for compatibility; layout is always single-column
  return (
    <form
      action={action}
      id={id}
      // A file input is only carried in a multipart body, which the browser decides from
      // this attribute rather than from the field list.
      encType={fields.some((field) => field.type === "file") ? "multipart/form-data" : undefined}
      className="grid grid-cols-1 gap-4"
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {fields.map((field) => {
        const htmlId = `${id}-${field.name}`;
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Label htmlFor={htmlId}>
              {field.label}
              {!field.required ? <span className="font-normal text-eavi-muted-text"> (optional)</span> : null}
            </Label>
            <Control field={field} htmlId={htmlId} options={options ?? {}} value={values?.[field.name]} />
            {field.hint ? <p className="text-xs text-eavi-muted-text">{field.hint}</p> : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} />
        {aside}
      </div>
    </form>
  );
}

/**
 * Inline disclosure rather than a dialog: the create form is server-rendered and costs
 * no client JavaScript, which keeps the portal light on slow connections.
 */
export function DisclosureForm(props: {
  button: string;
  title: string;
  id: string;
  fields: readonly Field[];
  options?: OptionSets;
  values?: Record<string, string | undefined>;
  action: FormAction;
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const { button, title, ...form } = props;

  return (
    <details className="rounded-2xl border border-eavi-border bg-eavi-card shadow-eavi-card open:shadow-eavi-lift">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <PlusIcon aria-hidden className="size-4 text-eavi-primary-text" />
        {button}
      </summary>
      <div className="border-t border-eavi-border p-4">
        <h2 className="mb-4 text-sm font-semibold">{title}</h2>
        <RecordForm {...form} />
      </div>
    </details>
  );
}

/**
 * The row-level form: a status change, a decision, a payment. It opens under the row it
 * belongs to so the administrator never loses sight of the record being edited.
 */
export function RowForm(props: {
  button: string;
  id: string;
  fields: readonly Field[];
  options?: OptionSets;
  values?: Record<string, string | undefined>;
  hidden?: Record<string, string>;
  action: FormAction;
  submitLabel: string;
  tone?: "neutral" | "danger";
  /** Read-only lines under the submit button, e.g. the file already on the record. */
  aside?: ReactNode;
  /** Two columns in a wider card, for a row that carries a whole record's fields. */
  wide?: boolean;
  /** Layout on the outer <details>, so the trigger can sit where the row needs it. */
  className?: string;
}) {
  const { button, tone = "neutral", wide = false, className, ...form } = props;

  return (
    <details className={className}>
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden",
          tone === "danger"
            ? "border-eavi-border text-eavi-destructive"
            : "border-eavi-border text-eavi-primary-text",
        )}
      >
        {button}
      </summary>
      <div
        className={cn(
          "mt-2 max-w-full rounded-xl border border-eavi-border bg-eavi-card p-3 shadow-eavi-card",
          wide ? "w-[20rem] sm:w-[34rem]" : "w-72",
        )}
      >
        <RecordForm {...form} compact={!wide} submitLabel={form.submitLabel} />
      </div>
    </details>
  );
}
