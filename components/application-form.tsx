"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ShimmerButton } from "@/components/magicui/shimmer-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  applyGrade,
  applyPage,
  genderChoices,
  gradeChoices,
  type Choice,
} from "@/lib/content/apply";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";

const EMPTY = {
  fullName: "",
  phone: "",
  email: "",
  gender: "",
  grade: "",
  programId: "",
  /** Bots fill this in; a person never sees it. */
  website: "",
};

type Values = typeof EMPTY;
type Errors = Partial<Record<keyof Values, string>>;

export function ApplicationForm({ programs }: { programs: Choice[] }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  /* Courses their grade does clear, filled in only after a refusal. */
  const [suggestions, setSuggestions] = useState<
    { id: string; name: string; minGrade: string }[]
  >([]);
  /* True once a refusal has reported that nothing on offer takes their grade. */
  const [nothingFits, setNothingFits] = useState(false);

  const [applied, setApplied] = useState<{
    reference: string;
    campusName: string;
    letterUrl: string | null;
  } | null>(null);

  const copy = applyPage.fields;

  function set(key: keyof Values, next: string) {
    setValues((current) => ({ ...current, [key]: next }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};

    if (values.fullName.trim().length < 2) next.fullName = copy.fullName.empty;
    if (!values.phone.trim()) next.phone = copy.phone.empty;
    else if (!normalizeKenyanPhone(values.phone)) next.phone = copy.phone.wrong;
    if (values.email.trim() && !isEmail(values.email)) next.email = copy.email.wrong;
    if (!values.gender) next.gender = copy.gender.empty;
    if (!values.grade) next.grade = copy.grade.empty;
    if (!values.programId) next.programId = copy.program.empty;

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // An answer the applicant can correct names its own field; a line below the form
        // would only repeat it and leave them guessing which box to fix.
        if (data.fieldErrors) {
          setErrors({ ...nextErrors, ...data.fieldErrors });
          // A refusal is only useful if it offers a way forward, so the alternatives the API
          // returned are kept and drawn as a list they can pick from.
          if (Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
            setNothingFits(data.suggestions.length === 0);
          }
        } else {
          setFailure(data.error ?? applyPage.errors.failed);
        }
        return;
      }

      setSuggestions([]);
      setNothingFits(false);
      setApplied({
        reference: data.reference,
        campusName: data.campusName,
        letterUrl: data.letterUrl ?? null,
      });
    } catch {
      setFailure(applyPage.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <Card className="w-full gap-0 py-0">
        <CardHeader className="gap-2 px-6 pt-7 pb-4">
          <CardTitle className="text-2xl">{applyPage.applied.heading}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {applyPage.applied.body}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-6 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-eavi-plate px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eavi-plate-muted">
                {applyPage.applied.reference}
              </p>
              <p className="text-lg leading-8 font-semibold tracking-wide text-eavi-plate-ink tabular-nums">
                {applied.reference}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-eavi-plate px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eavi-plate-muted">
                {applyPage.applied.campus}
              </p>
              <p className="text-lg leading-8 font-semibold text-eavi-plate-ink">{applied.campusName}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{applyPage.applied.stepsHeading}</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-6 text-muted-foreground">
              {applyPage.applied.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {/*
            * The letter is the point of this screen: it is generated at submission and is what the
            * applicant brings to enrolment, so it sits above "apply again" rather than below it.
            */}
          <LetterDownload letterUrl={applied.letterUrl} />

          <div className="flex flex-wrap gap-2">
            <ShimmerButton
              onClick={() => {
                setValues(EMPTY);
                setErrors({});
                setApplied(null);
              }}
            >
              {applyPage.applied.again}
            </ShimmerButton>
            <ShimmerButton asChild>
              <Link href="/">{applyPage.applied.home}</Link>
            </ShimmerButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full gap-0 py-0">
      <CardHeader className="gap-2 px-6 pt-7 pb-4">
        <CardTitle className="text-2xl">{applyPage.heading}</CardTitle>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          {applyPage.subheading}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Field>
            <FieldLabel htmlFor="apply-name">{copy.fullName.label}</FieldLabel>
            <Input
              id="apply-name"
              name="fullName"
              autoComplete="name"
              placeholder={copy.fullName.placeholder}
              value={values.fullName}
              onChange={(event) => set("fullName", event.target.value)}
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={errors.fullName ? "apply-name-error" : undefined}
            />
            <FieldError id="apply-name-error">{errors.fullName}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="apply-phone">{copy.phone.label}</FieldLabel>
            <Input
              id="apply-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={copy.phone.placeholder}
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "apply-phone-error" : undefined}
            />
            <FieldError id="apply-phone-error">{errors.phone}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="apply-email">
              {copy.email.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {copy.email.optional}
              </span>
            </FieldLabel>
            <Input
              id="apply-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={copy.email.placeholder}
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "apply-email-error" : undefined}
            />
            <FieldError id="apply-email-error">{errors.email}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="apply-gender">{copy.gender.label}</FieldLabel>
            <Select value={values.gender || undefined} onValueChange={(next) => set("gender", next)}>
              <SelectTrigger id="apply-gender" className="w-full">
                <SelectValue placeholder={copy.gender.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {genderChoices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="apply-gender-error">{errors.gender}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="apply-grade">{copy.grade.label}</FieldLabel>
            <Select value={values.grade || undefined} onValueChange={(next) => set("grade", next)}>
              <SelectTrigger id="apply-grade" className="w-full">
                <SelectValue placeholder={copy.grade.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {gradeChoices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.grade.hint}</FieldDescription>
            <FieldError id="apply-grade-error">{errors.grade}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="apply-program">{copy.program.label}</FieldLabel>
            <Select value={values.programId || undefined} onValueChange={(next) => set("programId", next)}>
              <SelectTrigger id="apply-program" className="w-full">
                <SelectValue placeholder={copy.program.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.value} value={program.value}>
                    {program.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="apply-program-error">{errors.programId}</FieldError>
          </Field>

          {/* Present for a bot to fill in and absent from the page a person reads. */}
          <div aria-hidden="true" className="absolute h-px w-px -left-[9999px] overflow-hidden">
            <label htmlFor="apply-website">{applyPage.botField}</label>
            <input
              id="apply-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(event) => set("website", event.target.value)}
            />
          </div>

          {failure && (
            <p role="alert" className="text-sm leading-6 font-medium text-destructive">
              {failure}
            </p>
          )}

          {/*
            The way forward after a refusal. Each suggestion is a button that picks that
            programme and submits again, because making an applicant scroll back to a select and
            find the course by name is the point where they give up instead.
          */}
          {suggestions.length > 0 || nothingFits ? (
            <div
              role="status"
              className="rounded-xl border border-border bg-muted/40 px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {nothingFits ? applyGrade.noneHeading : applyGrade.suggestionsHeading}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {nothingFits ? applyGrade.noneBody : applyGrade.suggestionsBody}
              </p>
              {suggestions.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {suggestions.map((choice) => (
                    <li key={choice.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm font-medium"
                        onClick={() => {
                          set("programId", choice.id);
                        }}
                      >
                        <span className="min-w-0">{choice.name}</span>
                        <span className="shrink-0 text-xs font-normal text-muted-foreground">
                          {applyGrade.requiresMinimum(choice.minGrade)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <ShimmerButton type="submit" className="mt-1 w-full" disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? applyPage.submitting : applyPage.submit}
          </ShimmerButton>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Downloads the admission letter.
 *
 * Fetched rather than linked so the wait is visible. The letter is a four-page PDF built on
 * demand, which takes a few seconds; a plain anchor would look like nothing happened and invite a
 * second click that starts a second build.
 */
function LetterDownload({ letterUrl }: { letterUrl: string | null }) {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const copy = applyPage.applied.letter;

  if (!letterUrl) {
    return (
      <p className="rounded-xl border border-border bg-eavi-plate px-4 py-3 text-sm leading-6 text-muted-foreground">
        {copy.missing}
      </p>
    );
  }

  const download = async () => {
    setState("working");
    try {
      const response = await fetch(letterUrl);
      if (!response.ok) throw new Error("failed");

      const blob = await response.blob();
      // The filename comes from the server's Content-Disposition, so the saved file is named
      // after the reference rather than something generic like "download.pdf".
      const disposition = response.headers.get("content-disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition)?.[1];

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = named ?? "Admission-Letter.pdf";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Released on the next tick: revoking synchronously can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setState("idle");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-eavi-border bg-eavi-bg p-4">
      <ShimmerButton type="button" onClick={download} disabled={state === "working"} className="min-h-11">
        {state === "working" ? copy.downloading : copy.button}
      </ShimmerButton>
      <p className="text-sm leading-6 text-muted-foreground">{copy.note}</p>
      {state === "failed" ? (
        <p role="alert" className="text-sm leading-6 font-medium">
          {copy.failed}
        </p>
      ) : null}
    </div>
  );
}
