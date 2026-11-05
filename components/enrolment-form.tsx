"use client";

import { useState } from "react";
import { enrolStudent } from "@/lib/actions/college/enrolment";
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

type Guardian = { fullName: string; relationship: string; phone: string; altPhone: string; email: string; occupation: string; address: string };
type Emergency = { fullName: string; relationship: string; phone: string; altPhone: string; address: string };

const emptyGuardian: Guardian = { fullName: "", relationship: "Guardian", phone: "", altPhone: "", email: "", occupation: "", address: "" };
const emptyEmergency: Emergency = { fullName: "", relationship: "Emergency", phone: "", altPhone: "", address: "" };

const inputCls = "h-11 w-full rounded-lg border border-input bg-eavi-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "text-sm font-medium text-eavi-text";

function LocationPicker({ prefix, label = "Residential address" }: { prefix: string; label?: string }) {
  const [county, setCounty] = useState("");
  const [subCounty, setSubCounty] = useState("");
  const countyObj = KENYA_COUNTIES.find((c) => c.name === county);
  return (
    <div className="sm:col-span-2 space-y-2">
      <span className={labelCls}>{label}</span>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name={`${prefix}County`} value={county} onChange={(e) => { setCounty(e.target.value); setSubCounty(""); }} className={inputCls}>
          <option value="">Select county (47)</option>
          {KENYA_COUNTIES.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
        </select>
        <select name={`${prefix}SubCounty`} value={subCounty} onChange={(e) => setSubCounty(e.target.value)} className={inputCls} disabled={!countyObj}>
          <option value="">{countyObj ? `Select sub-county (${countyObj.subCounties.length})` : "Select county first"}</option>
          {countyObj?.subCounties.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <input name={`${prefix}Detail`} placeholder="Town / estate / street" className={inputCls} />
      </div>
      <p className="text-xs text-eavi-muted-text">Choose the county, then only its sub-counties appear. Add the specific town or estate in the last box.</p>
    </div>
  );
}

export function EnrolmentForm({
  application: initialApplication,
  applications = [],
  programs,
  intakes,
}: {
  application?: Application | null;
  applications?: Application[];
  programs: Option[];
  intakes: Option[];
}) {
  const [selectedId, setSelectedId] = useState<string>(initialApplication?.id ?? "");
  const selectedApp = applications.find((a) => a.id === selectedId) ?? initialApplication ?? null;

  const [step, setStep] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([{ ...emptyGuardian }]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([{ ...emptyEmergency }]);

  return (
    <form action={enrolStudent} className="space-y-6" key={selectedApp?.id ?? "new"}>
      <input type="hidden" name="applicationId" value={selectedApp?.id ?? ""} />

      {/* Application selector */}
      {applications.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Enrol from existing application (optional)</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={inputCls}
          >
            <option value="">— New enrolment (enter details manually) —</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.reference ? `${a.reference} · ` : ""}{a.fullName} · {a.program.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-eavi-muted-text">Selecting an application auto-fills the student details below.</p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span className={"flex size-8 items-center justify-center rounded-full text-sm font-semibold " + (step === n ? "bg-eavi-fill text-eavi-on-fill" : step > n ? "bg-eavi-secondary text-eavi-on-success" : "bg-eavi-muted text-eavi-muted-text")}>{n}</span>
            <span className={step === n ? "text-sm font-semibold text-eavi-text" : "text-sm text-eavi-muted-text"}>{n === 1 ? "Student details" : "Parent & emergency"}</span>
            {n < 2 && <span className="mx-2 h-px w-8 bg-eavi-border" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      <div className={step === 1 ? "space-y-6" : "hidden"}>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-eavi-text">Student information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Full name</label>
              <input name="fullName" defaultValue={selectedApp?.fullName ?? ""} required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Email</label>
              <input name="email" type="email" defaultValue={selectedApp?.email ?? ""} required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Phone</label>
              <input name="phone" defaultValue={selectedApp?.phone ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Gender</label>
              <select name="gender" defaultValue={selectedApp?.gender ?? ""} className={inputCls}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="UNDECLARED">Prefer not to say</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Date of birth</label>
              <input name="dateOfBirth" type="date" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>National ID / birth cert no.</label>
              <input name="nationalId" className={inputCls} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Previous education</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Primary school</label>
              <input name="primarySchool" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Secondary school</label>
              <input name="secondarySchool" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Primary school document (PDF, optional)</label>
              <input name="primarySchoolDoc" type="file" accept="application/pdf" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Secondary school document (PDF, optional)</label>
              <input name="secondarySchoolDoc" type="file" accept="application/pdf" className={inputCls} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Birth certificate</h3>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Birth certificate (PDF)</label>
            <input name="birthCertificate" type="file" accept="application/pdf" className={inputCls} />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Medical information</h3>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Medical conditions</label>
            <textarea name="medicalInfo" rows={3} className="w-full rounded-lg border border-input bg-eavi-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <label className="flex items-center gap-2 text-sm text-eavi-text">
            <input type="checkbox" name="hasNoMedicalConditions" value="yes" className="size-4 accent-eavi-fill" />
            No known medical conditions
          </label>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Admission category</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Category</label>
              <select name="admissionCategory" className={inputCls}>
                <option value="NEW">New student</option>
                <option value="TRANSFER">Transfer student</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Previous institution (if transfer)</label>
              <input name="previousInstitution" className={inputCls} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Student profile photo</h3>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-eavi-primary-soft ring-2 ring-eavi-border">
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="size-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-12 text-eavi-primary-text" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className={labelCls}>Upload student photograph</label>
              <input name="profilePhoto" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1.5 file:text-eavi-primary-text" />
              <p className="text-xs text-eavi-muted-text">JPG or PNG. Used as the student's profile avatar throughout the system.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-eavi-text">Admission credentials</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Campus</label>
              <input value={selectedApp?.campus?.name ?? ""} readOnly className={inputCls + " bg-eavi-muted"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Programme</label>
              <select name="programId" defaultValue={selectedApp?.program.id ?? (programs[0]?.value ?? "")} required className={inputCls}>
                {programs.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Admission number (blank = auto)</label>
              <input name="admissionNo" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Intake</label>
              <select name="intakeId" className={inputCls}>
                <option value="">—</option>
                {intakes.map((i) => (<option key={i.value} value={i.value}>{i.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Temporary password</label>
              <input name="password" type="text" required minLength={10} className={inputCls} />
            </div>
            <LocationPicker prefix="address" />
          </div>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={() => setStep(2)} className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill">
            Next: parent &amp; emergency
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div className={step === 2 ? "space-y-6" : "hidden"}>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-eavi-text">Parent / guardian</h2>
          {guardians.map((g, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-eavi-border bg-eavi-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-eavi-text">Guardian {idx + 1}</h3>
                {guardians.length > 1 && (
                  <button type="button" onClick={() => setGuardians((gs) => gs.filter((_, i) => i !== idx))} className="text-xs text-eavi-destructive">Remove</button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Full name</label>
                  <input name="guardianFullName" defaultValue={g.fullName} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Relationship</label>
                  <select name="guardianRelationship" defaultValue={g.relationship} className={inputCls}>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Phone</label>
                  <input name="guardianPhone" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Alternative phone</label>
                  <input name="guardianAltPhone" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Email</label>
                  <input name="guardianEmail" type="email" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Occupation (optional)</label>
                  <input name="guardianOccupation" className={inputCls} />
                </div>
                <LocationPicker prefix="guardian" label="Residential address" />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setGuardians((gs) => [...gs, { ...emptyGuardian }])} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text">
            + Add another guardian
          </button>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-eavi-text">Emergency contact</h2>
          {emergencies.map((e, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-eavi-border bg-eavi-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-eavi-text">Emergency contact {idx + 1}</h3>
                {emergencies.length > 1 && (
                  <button type="button" onClick={() => setEmergencies((es) => es.filter((_, i) => i !== idx))} className="text-xs text-eavi-destructive">Remove</button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Full name</label>
                  <input name="emergencyFullName" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Relationship</label>
                  <input name="emergencyRelationship" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Primary phone</label>
                  <input name="emergencyPhone" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Alternative phone</label>
                  <input name="emergencyAltPhone" className={inputCls} />
                </div>
                <LocationPicker prefix="emergency" label="Residential address (optional)" />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setEmergencies((es) => [...es, { ...emptyEmergency }])} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text">
            + Add another emergency contact
          </button>
        </section>

        <div className="flex justify-between">
          <button type="button" onClick={() => setStep(1)} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text">
            Previous
          </button>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill">
            Complete enrolment
          </button>
        </div>
      </div>
    </form>
  );
}