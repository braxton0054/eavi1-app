"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ReviewAnimation } from "@/components/review-animation";
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

type Found = {
  status: "applied";
  reference: string;
  fullName: string;
  campusName: string;
  program: { id: string; name: string; code: string };
  letterUrl: string | null;
};

/** Fetch the A4 PDF and hand it to the browser. The filename comes from the server. */
async function downloadPdf(letterUrl: string): Promise<void> {
  const url = `${letterUrl}${letterUrl.includes("?") ? "&" : "?"}format=pdf`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("failed");
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const named = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "Admission-Letter.pdf";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = named;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

export function ApplicationForm({ programs }: { programs: (Choice & { minGrade?: string | null })[] }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; minGrade: string }[]>([]);
  const [nothingFits, setNothingFits] = useState(false);

  const [lookup, setLookup] = useState("");
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [enrolledCampus, setEnrolledCampus] = useState<string | null>(null);
  const [newProgramId, setNewProgramId] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState("");

  const [submitted, setSubmitted] = useState<{ reference: string; campusName: string; letterUrl: string | null } | null>(null);

  const copy = applyPage.fields;

  // The same order the server uses: best grade first, so a lower index is a better grade.
  const GRADE_ORDER = ["A","A_MINUS","B_PLUS","B","B_MINUS","C_PLUS","C","C_MINUS","D_PLUS","D","D_MINUS","E"];
  const eligiblePrograms = values.grade
    ? programs.filter((program) => {
        if (!program.minGrade) return true;
        return GRADE_ORDER.indexOf(values.grade) <= GRADE_ORDER.indexOf(program.minGrade);
      })
    : programs;

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

  async function findApplication(event: FormEvent) {
    event.preventDefault();
    setFailure("");
    setNotFound(false);
    setFound(null);
    setEnrolledCampus(null);
    if (!lookup.trim()) {
      setFailure(applyPage.lookup.onlyOne);
      return;
    }
    setLooking(true);
    try {
      const response = await fetch("/api/applications/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: lookup.trim() }),
      });
      const data = await response.json();
      if (data.status === "enrolled") setEnrolledCampus(data.campusName);
      else if (data.status === "applied") {
        setFound(data as Found);
        setNewProgramId(data.program?.id ?? "");
      } else setNotFound(true);
    } catch {
      setFailure(applyPage.errors.failed);
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
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
        if (data.status === "enrolled") {
          setEnrolledCampus(data.message?.match(/visit the (.+?) offices/)?.[1] ?? "campus");
          return;
        }
        if (data.fieldErrors) {
          setErrors({ ...nextErrors, ...data.fieldErrors });
          if (Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
            setNothingFits(data.suggestions.length === 0);
          }
        } else setFailure(data.error ?? applyPage.errors.failed);
        return;
      }

      setSuggestions([]);
      setNothingFits(false);
      setSubmitted({
        reference: data.reference,
        campusName: data.campusName,
        letterUrl: data.letterUrl ?? null,
      });
      // The letter is the point of the screen: download it as soon as it is ready.
      if (data.letterUrl) await downloadPdf(data.letterUrl).catch(() => undefined);
    } catch {
      setFailure(applyPage.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  async function changeProgramme(event: FormEvent) {
    event.preventDefault();
    if (!found || !newProgramId) return;
    setChanging(true);
    setChangeError("");
    try {
      const token = found.letterUrl ? new URL(found.letterUrl, window.location.origin).searchParams.get("t") : null;
      const response = await fetch("/api/applications/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: found.reference, verifyToken: token, programId: newProgramId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setChangeError(data.error ?? applyPage.applied.changeFailed);
        return;
      }
      setFound({ ...found, program: { ...found.program, id: newProgramId }, letterUrl: data.letterUrl ?? found.letterUrl });
      if (data.letterUrl) await downloadPdf(data.letterUrl).catch(() => undefined);
    } catch {
      setChangeError(applyPage.applied.changeFailed);
    } finally {
      setChanging(false);
    }
  }

  // --------------------------------------------------------------- reviewing
  if (busy) {
    return (
      <Card className="w-full gap-0 py-0">
        <CardHeader className="items-center gap-4 px-6 pt-8 pb-2 text-center">
          <CardTitle className="text-xl">{applyPage.applied.reviewing}</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-10">
          <ReviewAnimation steps={applyPage.applied.reviewSteps} hint={applyPage.applied.reviewHint} />
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------- enrolled
  if (enrolledCampus) {
    return (
      <Card className="w-full gap-0 py-0">
        <CardHeader className="px-6 pt-8 pb-4">
          <CardTitle className="text-2xl">Already enrolled</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {applyPage.lookup.enrolled.replace("__CAMPUS__", enrolledCampus)}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <ButtonLink href="/">{applyPage.applied.home}</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------- submitted
  if (submitted) {
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
            <Summary label={applyPage.applied.reference} value={submitted.reference} />
            <Summary label={applyPage.applied.campus} value={submitted.campusName} />
          </div>
          <LetterPanel
            letterUrl={submitted.letterUrl}
            label={applyPage.applied.letter.buttonPdf}
            onDownload={downloadPdf}
          />
          <div>
            <p className="text-sm font-semibold">{applyPage.applied.stepsHeading}</p>
            <ol className="mt-1 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-6 text-muted-foreground">
              {applyPage.applied.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          <ButtonLink href="/">{applyPage.applied.home}</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------ found
  if (found) {
    return (
      <Card className="w-full gap-0 py-0">
        <CardHeader className="gap-2 px-6 pt-7 pb-4">
          <CardTitle className="text-2xl">{applyPage.lookup.found}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {found.fullName} · {applyPage.applied.reference} {found.reference}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-6 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Summary label={applyPage.applied.campus} value={found.campusName} />
            <Summary label={applyPage.lookup.programme} value={found.program.name} />
          </div>
          <LetterPanel
            letterUrl={found.letterUrl}
            label={applyPage.applied.letter.buttonPdf}
            onDownload={downloadPdf}
          />
          <form onSubmit={changeProgramme} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
            <p className="text-sm font-semibold">{applyPage.applied.changeProgramme}</p>
            <Select value={newProgramId} onValueChange={setNewProgramId}>
              <SelectTrigger id="change-program" className="w-full">
                <SelectValue placeholder={copy.program.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.value} value={program.value}>{program.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {changeError ? <p role="alert" className="text-sm font-medium text-destructive">{changeError}</p> : null}
            <ShimmerButton type="submit" disabled={changing || !newProgramId} className="w-full">
              {changing && <Spinner data-icon="inline-start" />}
              {changing ? applyPage.applied.changing : applyPage.applied.changeProgramme}
            </ShimmerButton>
          </form>
          <ButtonLink href="/">{applyPage.applied.home}</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------ apply + lookup
  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full gap-0 py-0">
        <CardHeader className="gap-2 px-6 pt-7 pb-4">
          <CardTitle className="text-xl">{applyPage.lookup.heading}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {applyPage.lookup.body}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={findApplication} className="flex flex-col gap-3 sm:flex-row">
            <Input
              aria-label={applyPage.lookup.emailOrPhone}
              placeholder={applyPage.lookup.placeholder}
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              className="min-h-11 flex-1"
            />
            <ShimmerButton type="submit" disabled={looking}>
              {looking && <Spinner data-icon="inline-start" />}
              {looking ? applyPage.lookup.searching : applyPage.lookup.button}
            </ShimmerButton>
          </form>
          {notFound ? <p role="status" className="mt-3 text-sm text-muted-foreground">{applyPage.lookup.none}</p> : null}
        </CardContent>
      </Card>

      <Card className="w-full gap-0 py-0">
        <CardHeader className="px-6 pt-7 pb-4">
          <CardTitle className="text-xl">{applyPage.heading}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {applyPage.subheading}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="apply-fullName">{copy.fullName.label}</FieldLabel>
              <Input id="apply-fullName" value={values.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
              <FieldError id="apply-fullName-error">{errors.fullName}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="apply-phone">{copy.phone.label}</FieldLabel>
                <Input id="apply-phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="0712 345 678" autoComplete="tel" />
                <FieldError id="apply-phone-error">{errors.phone}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="apply-email">{copy.email.label} <span className="font-normal text-muted-foreground">({copy.email.optional})</span></FieldLabel>
                <Input id="apply-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder={copy.email.placeholder} autoComplete="email" />
                <FieldError id="apply-email-error">{errors.email}</FieldError>
              </Field>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">{copy.gender.label}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {genderChoices.map((choice) => (
                  <label key={choice.value} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-eavi-card px-3 text-sm font-medium has-[:checked]:border-eavi-fill has-[:checked]:bg-eavi-primary-soft">
                    <input type="radio" name="gender" value={choice.value} checked={values.gender === choice.value} onChange={(e) => set("gender", e.target.value)} className="size-5 accent-eavi-fill" />
                    {choice.label}
                  </label>
                ))}
              </div>
              <FieldError id="apply-gender-error">{errors.gender}</FieldError>
            </fieldset>
            <Field>
              <FieldLabel htmlFor="apply-grade">{copy.grade.label}</FieldLabel>
              <Select value={values.grade || undefined} onValueChange={(next) => set("grade", next)}>
                <SelectTrigger id="apply-grade" className="w-full"><SelectValue placeholder={copy.grade.placeholder} /></SelectTrigger>
                <SelectContent>
                  {gradeChoices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldDescription>{copy.grade.hint}</FieldDescription>
              <FieldError id="apply-grade-error">{errors.grade}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="apply-program">{copy.program.label}</FieldLabel>
              <Select value={values.programId || undefined} onValueChange={(next) => set("programId", next)}>
                <SelectTrigger id="apply-program" className="w-full"><SelectValue placeholder={copy.program.placeholder} /></SelectTrigger>
                <SelectContent>
                  {eligiblePrograms.map((program) => <SelectItem key={program.value} value={program.value}>{program.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {values.grade && eligiblePrograms.length === 0 ? (
                <p className="text-sm font-medium text-destructive">{applyGrade.noneBody}</p>
              ) : null}
              <FieldError id="apply-program-error">{errors.programId}</FieldError>
            </Field>
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="apply-website">{applyPage.botField}</label>
              <input id="apply-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            {failure ? <p role="alert" className="text-sm font-medium text-destructive">{failure}</p> : null}
            {suggestions.length > 0 || nothingFits ? (
              <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-sm font-semibold">{nothingFits ? applyGrade.noneHeading : applyGrade.suggestionsHeading}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{nothingFits ? applyGrade.noneBody : applyGrade.suggestionsBody}</p>
                {suggestions.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {suggestions.map((choice) => (
                      <li key={choice.id}>
                        <button type="button" onClick={() => set("programId", choice.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm font-medium">
                          <span className="min-w-0">{choice.name}</span>
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">{applyGrade.requiresMinimum(choice.minGrade)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <ShimmerButton type="submit" disabled={busy} className="w-full">
              {busy && <Spinner data-icon="inline-start" />}
              {busy ? applyPage.submitting : applyPage.submit}
            </ShimmerButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-eavi-plate px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eavi-plate-muted">{label}</p>
      <p className="text-lg font-semibold leading-8 text-eavi-plate-ink">{value}</p>
    </div>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-medium">
      {children}
    </Link>
  );
}

function LetterPanel({
  letterUrl,
  label,
  onDownload,
}: {
  letterUrl: string | null;
  label: string;
  onDownload: (url: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!letterUrl) {
    return <p className="rounded-xl border border-border bg-eavi-plate px-4 py-3 text-sm text-muted-foreground">{applyPage.applied.letter.missing}</p>;
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-eavi-plate p-4">
      <p className="text-sm font-semibold">Admission letter (A4 PDF)</p>
      <ShimmerButton
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try { await onDownload(letterUrl); } catch { setFailed(true); } finally { setBusy(false); }
        }}
        className="w-full"
      >
        {busy && <Spinner data-icon="inline-start" />}
        {busy ? applyPage.applied.letter.downloading : label}
      </ShimmerButton>
      {failed ? <p role="alert" className="text-sm font-medium text-destructive">{applyPage.applied.letter.failed}</p> : null}
    </div>
  );
}
