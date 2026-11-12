"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { enrolStudent } from "@/lib/actions/college/enrolment";
import type { ClassOption } from "@/lib/dal/classes";
import { nextClassLetter } from "@/lib/academics/classes";
import { genderChoices } from "@/lib/content/apply";
import { KENYA_COUNTIES } from "@/lib/data/kenya-locations";

type Option = { value: string; label: string };

type Application = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  gender: string | null;
  program: { id: string; name: string; code: string };
  campus: { name: string } | null;
  reference?: string;
};

type Guardian = { fullName: string; relationship: string; phone: string; altPhone: string; email: string; occupation: string };
type Emergency = { fullName: string; relationship: string; phone: string; altPhone: string };

const emptyGuardian: Guardian = { fullName: "", relationship: "Guardian", phone: "", altPhone: "", email: "", occupation: "" };
const emptyEmergency: Emergency = { fullName: "", relationship: "Emergency", phone: "", altPhone: "" };

const inputCls =
  "h-11 w-full rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const labelCls = "text-sm font-medium text-eavi-text";

function Section({ step, title, hint, children }: { step?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-eavi-border bg-eavi-card p-4 shadow-eavi-card sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        {step ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-eavi-primary-soft text-xs font-bold text-eavi-primary-text">
            {step}
          </span>
        ) : null}
        <div>
          <h2 className="text-base font-semibold text-eavi-text">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-eavi-muted-text">{hint}</p> : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children, wide, error }: { label: string; children: ReactNode; wide?: boolean; error?: string }) {
  return (
    <div className={"flex flex-col gap-1.5" + (wide ? " sm:col-span-2" : "")}>
      <label className={labelCls}>{label}</label>
      {children}
      {error ? <p className="text-xs font-medium text-eavi-destructive">{error}</p> : null}
    </div>
  );
}

function EnrolSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-eavi-fill px-6 text-sm font-medium text-eavi-on-fill disabled:opacity-60"
    >
      {pending ? <Loader2Icon aria-hidden className="size-4 animate-spin" /> : null}
      {pending ? "Enrolling student…" : "Complete enrolment"}
    </button>
  );
}

function LocationPicker({ prefix, label = "Residential address" }: { prefix: string; label?: string }) {
  const [county, setCounty] = useState("");
  const [subCounty, setSubCounty] = useState("");
  const countyObj = KENYA_COUNTIES.find((c) => c.name === county);
  return (
    <div className="space-y-2 sm:col-span-2">
      <span className={labelCls}>{label}</span>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          name={`${prefix}County`}
          value={county}
          onChange={(e) => {
            setCounty(e.target.value);
            setSubCounty("");
          }}
          className={inputCls}
        >
          <option value="">County (47)…</option>
          {KENYA_COUNTIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name={`${prefix}SubCounty`}
          value={subCounty}
          onChange={(e) => setSubCounty(e.target.value)}
          className={inputCls}
          disabled={!countyObj}
        >
          <option value="">{countyObj ? `Sub-county (${countyObj.subCounties.length})…` : "Pick county first…"}</option>
          {countyObj?.subCounties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input name={`${prefix}Detail`} placeholder="Town / estate / street" className={inputCls} />
      </div>
    </div>
  );
}

const STEPS = [
  { n: 1, label: "Student", hint: "Identity, schooling & credentials" },
  { n: 2, label: "Family", hint: "Guardians & emergency contacts" },
] as const;

export function EnrolmentForm({
  application: initialApplication,
  applications = [],
  programs,
  intakes,
  classes = [],
  placementsByProgram = {},
}: {
  application?: Application | null;
  applications?: Application[];
  programs: Option[];
  intakes: Option[];
  /** Classes already created on this campus, tagged with their programme and intake. */
  classes?: ClassOption[];
  /** Each programme's own academic stages, keyed by programme id. */
  placementsByProgram?: Record<string, Option[]>;
}) {
  const [selectedId, setSelectedId] = useState<string>(initialApplication?.id ?? "");
  const selectedApp = applications.find((a) => a.id === selectedId) ?? initialApplication ?? null;

  const [step, setStep] = useState(1);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  // The student's stage depends on the programme, so the list follows the programme picker
  // instead of being fixed to whichever programme was listed first.
  const [programId, setProgramId] = useState<string>(
    initialApplication?.program.id ?? programs[0]?.value ?? "",
  );
  const stages = placementsByProgram?.[programId] ?? [];

  /* The intake decides the class list as much as the programme does: a class is one programme in
     one intake, so January's ICT/A and May's ICT/A are different cohorts and one cannot stand in
     for the other. Held in state so the class list can react to it. */
  const [intakeId, setIntakeId] = useState<string>(initialApplication ? "" : "");

  /*
   * Classes the chosen programme teaches in the chosen intake. Empty until an intake is chosen,
   * because before that there is no cohort to place the student in and offering every class of
   * the programme would invite exactly the January-into-May mistake this guards against.
   */
  const classesInIntake = intakeId
    ? classes.filter((option) => option.programId === programId && option.intakeId === intakeId)
    : [];
  const classChoices = classesInIntake;

  /*
   * The next free letter for this intake, so the office is offered "B" when A is taken instead of
   * having to read the list and work it out. Only a hint: they may type any name they like, and a
   * class without a letter is still valid.
   */
  const suggestedLetter = nextClassLetter(classesInIntake.map((option) => option.label));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([{ ...emptyGuardian }]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([{ ...emptyEmergency }]);

  function validateStepOne(): boolean {
    const form = formRef.current;
    if (!form) return true;
    const fd = new FormData(form);
    const errors: Record<string, string> = {};
    const fullName = String(fd.get("fullName") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const program = String(fd.get("programId") ?? "").trim();
    const intake = String(fd.get("intakeId") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!fullName) errors.fullName = "Enter the student's full name.";
    if (!email) errors.email = "Enter the sign-in email address.";
    if (!program) errors.programId = "Choose a programme.";
    if (!intake) errors.intakeId = "Choose the official intake.";
    if (!password) errors.password = "Enter a temporary password.";
    else if (password.length < 10) errors.password = "Temporary password must be at least 10 characters.";
    setStepErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    return true;
  }

  function goToFamily() {
    if (validateStepOne()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!validateStepOne()) {
      event.preventDefault();
    }
  }

  return (
    <form ref={formRef} action={enrolStudent} onSubmit={handleSubmit} className="space-y-5" key={selectedApp?.id ?? "new"} noValidate>
      <input type="hidden" name="applicationId" value={selectedApp?.id ?? ""} />

      {Object.keys(stepErrors).length > 0 ? (
        <div role="alert" className="rounded-xl border border-eavi-border bg-eavi-warn-soft px-4 py-3 text-sm text-eavi-warn-text">
          <p className="font-semibold">Some required details are missing.</p>
          <p className="mt-0.5 opacity-90">Check the highlighted fields below before continuing.</p>
        </div>
      ) : null}

      {/* Stepper */}
      <ol className="flex items-start gap-2 rounded-2xl border border-eavi-border bg-eavi-card p-3 shadow-eavi-card" aria-label="Enrolment progress">
        {STEPS.map((s, i) => (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(s.n)}
              className={
                "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors " +
                (step === s.n ? "bg-eavi-primary-soft" : "hover:bg-eavi-muted")
              }
              aria-current={step === s.n ? "step" : undefined}
            >
              <span
                className={
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                  (step > s.n
                    ? "bg-eavi-success-fill text-eavi-on-success"
                    : step === s.n
                      ? "bg-eavi-fill text-eavi-on-fill"
                      : "bg-eavi-muted text-eavi-muted-text")
                }
              >
                {step > s.n ? "✓" : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-semibold text-eavi-text sm:truncate">
                  {i + 1}. {s.label}
                </span>
                <span className="hidden text-xs leading-tight text-eavi-muted-text sm:block sm:truncate">{s.hint}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && <span className="hidden h-px w-6 bg-eavi-border sm:block" aria-hidden />}
          </li>
        ))}
      </ol>

      {/* Application picker */}
      {applications.length > 0 && (
        <div className="rounded-2xl border border-dashed border-eavi-border bg-eavi-muted/40 p-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} htmlFor="enrol-application">
              Enrol from application
            </label>
            <select id="enrol-application" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputCls + " bg-eavi-card"}>
              <option value="">— Fill in manually —</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.reference ? `${a.reference} · ` : ""}
                  {a.fullName} · {a.program.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-eavi-muted-text">
              {selectedApp ? `Auto-filled from ${selectedApp.reference ?? "application"}. Review and edit below.` : "Pick a submitted application to auto-fill the form."}
            </p>
          </div>
        </div>
      )}

      {/* STEP 1 */}
      <div className={step === 1 ? "space-y-5" : "hidden"}>
        <Section step="A" title="Student identity" hint="From the application — review and edit.">
          <Field label="Full name" error={stepErrors.fullName}>
            <input name="fullName" defaultValue={selectedApp?.fullName ?? ""} required className={inputCls} aria-invalid={stepErrors.fullName ? true : undefined} />
          </Field>
          <Field label="Email (sign-in)" error={stepErrors.email}>
            <input name="email" type="email" defaultValue={selectedApp?.email ?? ""} required className={inputCls} aria-invalid={stepErrors.email ? true : undefined} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={selectedApp?.phone ?? ""} className={inputCls} />
          </Field>
          <Field label="Gender">
            <select name="gender" defaultValue={selectedApp?.gender ?? ""} className={inputCls}>
              <option value="">—</option>
              {genderChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth">
            <input name="dateOfBirth" type="date" className={inputCls} />
          </Field>
          <Field label="National ID / birth cert no.">
            <input name="nationalId" className={inputCls} />
          </Field>
        </Section>

        <Section step="B" title="Photo" hint="Shows as the student's avatar across the portal.">
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-eavi-primary-soft ring-2 ring-eavi-border" aria-hidden>
              {photoPreview ? (
                <img src={photoPreview} alt="" className="size-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-12 text-eavi-primary-text">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={labelCls} htmlFor="profile-photo">Student photograph</label>
              <input
                id="profile-photo"
                name="profilePhoto"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhotoPreview(URL.createObjectURL(f));
                }}
                className="block w-full min-h-11 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1.5 file:text-eavi-primary-text"
              />
              <p className="text-xs text-eavi-muted-text">JPG or PNG.</p>
            </div>
          </div>
        </Section>

        <Section step="C" title="Schooling & documents" hint="PDF uploads where available.">
          <Field label="Primary school">
            <input name="primarySchool" className={inputCls} />
          </Field>
          <Field label="Secondary school">
            <input name="secondarySchool" className={inputCls} />
          </Field>
          <Field label="Primary school document (PDF, optional)">
            <input name="primarySchoolDoc" type="file" accept="application/pdf" className={inputCls} />
          </Field>
          <Field label="Secondary school document (PDF, optional)">
            <input name="secondarySchoolDoc" type="file" accept="application/pdf" className={inputCls} />
          </Field>
          <Field label="Birth certificate (PDF)" wide>
            <input name="birthCertificate" type="file" accept="application/pdf" className={inputCls} />
          </Field>
        </Section>

        <Section step="D" title="Medical" hint="Visible to authorised staff only.">
          <Field label="Medical conditions" wide>
            <textarea
              name="medicalInfo"
              rows={3}
              placeholder="Allergies, conditions, medication…"
              className="w-full rounded-lg border border-input bg-eavi-card eavi-carved px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm text-eavi-text sm:col-span-2">
            <input type="checkbox" name="hasNoMedicalConditions" value="yes" className="size-5 accent-eavi-fill" />
            No known medical conditions
          </label>
        </Section>

        <Section step="E" title="Admission" hint="Category, programme and sign-in credentials.">
          <Field label="Category">
            <select name="admissionCategory" className={inputCls}>
              <option value="NEW">New student</option>
              <option value="TRANSFER">Transfer student</option>
            </select>
          </Field>
          <Field label="Previous institution (if transfer)">
            <input name="previousInstitution" className={inputCls} />
          </Field>
          <Field label="Programme" error={stepErrors.programId}>
            <select
              name="programId"
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
                if (stepErrors.programId) setStepErrors((e) => ({ ...e, programId: "" }));
              }}
              required
              className={inputCls}
              aria-invalid={stepErrors.programId ? true : undefined}
            >
              {programs.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Admission number (blank = auto)">
            <input name="admissionNo" className={inputCls} />
          </Field>
          {/* No default. Pre-filling today silently stamped a January intake with the
              day the clerk happened to type the form, which then made every bill for that
              student look months overdue. Blank means "use the intake's own start". */}
          <Field label="Admission date (blank = intake start)">
            <input type="date" name="admissionDate" className={inputCls} />
          </Field>
          <Field label="Official intake" error={stepErrors.intakeId}>
            <select
              name="intakeId"
              required
              value={intakeId}
              onChange={(event) => {
                setIntakeId(event.target.value);
                if (stepErrors.intakeId) setStepErrors((e) => ({ ...e, intakeId: "" }));
              }}
              className={inputCls}
              aria-invalid={stepErrors.intakeId ? true : undefined}
            >
              <option value="">—</option>
              {intakes.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-eavi-muted-text sm:col-span-2">
            Admissions run every month; intakes are only January, May and September. A student admitted
            in February joins the January intake — their admission date is kept separately.
          </p>

          {/* Keyed on the programme and intake together: switching either one remounts the
              select, which clears a class chosen for the previous cohort instead of leaving a
              now-invalid id selected. */}
          <Field label="Class">
            <select
              name="classId"
              key={`cls-${programId}-${intakeId}`}
              className={inputCls}
              disabled={!intakeId}
            >
              <option value="">
                {intakeId ? (classChoices.length ? "No class yet" : "None — create one below") : "Choose an intake first"}
              </option>
              {classChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Or create a class now">
            <input
              name="newClassName"
              key={`new-${programId}-${intakeId}`}
              /* Named after the intake's own class list rather than a made-up example, so the
                 hint is the next letter that really is free. */
              placeholder={
                !intakeId
                  ? "Choose an intake first"
                  : suggestedLetter
                    ? `Leave blank unless adding a group — next free letter: ${suggestedLetter}`
                    : "Type a class name"
              }
              className={inputCls}
            />
          </Field>

          <Field label="Academic stage on joining" wide>
            <select name="stage" defaultValue={stages[0]?.value ?? ""} key={programId} className={inputCls}>
              {stages.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-eavi-muted-text sm:col-span-2">
            A student who completed Semester 1 elsewhere, or who has approved prior credit, can start
            part-way in. The class does not decide this.
          </p>
          <Field label="Temporary password (min 10 chars)" wide error={stepErrors.password}>
            <input
              name="password"
              type="text"
              required
              minLength={10}
              placeholder="Student changes this on first login"
              className={inputCls}
              aria-invalid={stepErrors.password ? true : undefined}
              onChange={() => {
                if (stepErrors.password) setStepErrors((e) => ({ ...e, password: "" }));
              }}
            />
          </Field>
          <LocationPicker prefix="address" />
        </Section>

        <div className="sticky bottom-0 flex justify-end rounded-2xl border border-eavi-border bg-eavi-card/95 p-3 shadow-eavi-card backdrop-blur">
          <button type="button" onClick={goToFamily} className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-6 text-sm font-medium text-eavi-on-fill">
            Continue to family →
          </button>
        </div>
      </div>

      {/* STEP 2 */}
      <div className={step === 2 ? "space-y-5" : "hidden"}>
        <Section step="F" title="Parent / guardian" hint="Add more than one where needed.">
          <div className="space-y-4 sm:col-span-2">
            {guardians.map((g, idx) => (
              <div key={idx} className="space-y-4 rounded-xl border border-eavi-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-eavi-text">Guardian {idx + 1}</h3>
                  {guardians.length > 1 && (
                    <button type="button" onClick={() => setGuardians((gs) => gs.filter((_, i) => i !== idx))} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-eavi-destructive">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input name="guardianFullName" defaultValue={g.fullName} className={inputCls} />
                  </Field>
                  <Field label="Relationship">
                    <select name="guardianRelationship" defaultValue={g.relationship} className={inputCls}>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Phone">
                    <input name="guardianPhone" className={inputCls} />
                  </Field>
                  <Field label="Alternative phone">
                    <input name="guardianAltPhone" className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input name="guardianEmail" type="email" className={inputCls} />
                  </Field>
                  <Field label="Occupation (optional)">
                    <input name="guardianOccupation" className={inputCls} />
                  </Field>
                  <LocationPicker prefix="guardian" label="Residential address" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setGuardians((gs) => [...gs, { ...emptyGuardian }])} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted">
              + Add another guardian
            </button>
          </div>
        </Section>

        <Section step="G" title="Emergency contact" hint="Kept separate from the guardian above.">
          <div className="space-y-4 sm:col-span-2">
            {emergencies.map((e, idx) => (
              <div key={idx} className="space-y-4 rounded-xl border border-eavi-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-eavi-text">Emergency contact {idx + 1}</h3>
                  {emergencies.length > 1 && (
                    <button type="button" onClick={() => setEmergencies((es) => es.filter((_, i) => i !== idx))} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-eavi-destructive">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input name="emergencyFullName" className={inputCls} />
                  </Field>
                  <Field label="Relationship">
                    <input name="emergencyRelationship" placeholder="e.g. Uncle, Aunt" className={inputCls} />
                  </Field>
                  <Field label="Primary phone">
                    <input name="emergencyPhone" className={inputCls} />
                  </Field>
                  <Field label="Alternative phone">
                    <input name="emergencyAltPhone" className={inputCls} />
                  </Field>
                  <LocationPicker prefix="emergency" label="Residential address (optional)" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setEmergencies((es) => [...es, { ...emptyEmergency }])} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted">
              + Add another emergency contact
            </button>
          </div>
        </Section>

        <div className="sticky bottom-0 flex items-center justify-between rounded-2xl border border-eavi-border bg-eavi-card/95 p-3 shadow-eavi-card backdrop-blur">
          <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted">
            ← Back
          </button>
          <EnrolSubmitButton />
        </div>
      </div>
    </form>
  );
}
