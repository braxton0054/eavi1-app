"use client";

import { useState } from "react";
import { enrolStudent } from "@/lib/actions/college/enrolment";

type Option = { value: string; label: string };

export function EnrolmentForm({
  application,
  programs,
  intakes,
}: {
  application: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    gender: string | null;
    program: { id: string; name: string; code: string };
    campus: { name: string } | null;
  };
  programs: Option[];
  intakes: Option[];
}) {
  const [step, setStep] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  return (
    <form action={enrolStudent} encType="multipart/form-data" className="space-y-6">
      <input type="hidden" name="applicationId" value={application.id} />
      <input type="hidden" name="programId" value={application.program.id} />

      <div className="flex items-center gap-2 text-sm">
        <span className={step === 1 ? "font-semibold text-eavi-primary-text" : "text-eavi-muted-text"}>1. Student details</span>
        <span className="text-eavi-muted-text">→</span>
        <span className={step === 2 ? "font-semibold text-eavi-primary-text" : "text-eavi-muted-text"}>2. Parent & emergency</span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Student information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Full name</label>
              <input name="fullName" defaultValue={application.fullName} required className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email</label>
              <input name="email" type="email" defaultValue={application.email ?? ""} required className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Phone</label>
              <input name="phone" defaultValue={application.phone} className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Gender</label>
              <select name="gender" defaultValue={application.gender ?? ""} className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm">
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="UNDECLARED">Prefer not to say</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Date of birth</label>
              <input name="dateOfBirth" type="date" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">National ID / birth cert no.</label>
              <input name="nationalId" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
          </div>

          <h3 className="text-base font-semibold">Previous education</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Primary school</label>
              <input name="primarySchool" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Secondary school</label>
              <input name="secondarySchool" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Primary school document (PDF, optional)</label>
              <input name="primarySchoolDoc" type="file" accept="application/pdf" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Secondary school document (PDF, optional)</label>
              <input name="secondarySchoolDoc" type="file" accept="application/pdf" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
          </div>

          <h3 className="text-base font-semibold">Birth certificate</h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Birth certificate (PDF)</label>
            <input name="birthCertificate" type="file" accept="application/pdf" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
          </div>

          <h3 className="text-base font-semibold">Medical information</h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Medical conditions</label>
            <textarea name="medicalInfo" rows={3} className="rounded-lg border border-input bg-eavi-card px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hasNoMedicalConditions" value="yes" />
            No known medical conditions
          </label>

          <h3 className="text-base font-semibold">Admission category</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Category</label>
              <select name="admissionCategory" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm">
                <option value="NEW">New student</option>
                <option value="TRANSFER">Transfer student</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Previous institution (if transfer)</label>
              <input name="previousInstitution" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
          </div>

          <h3 className="text-base font-semibold">Profile photo</h3>
          <div className="flex items-center gap-4">
            {photoPreview && (
              <img src={photoPreview} alt="preview" className="size-20 rounded-full object-cover ring-1 ring-eavi-border" />
            )}
            <input
              name="profilePhoto"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoPreview(URL.createObjectURL(f));
              }}
              className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm"
            />
          </div>

          <h3 className="text-base font-semibold">Admission credentials</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Campus</label>
              <input value={application.campus?.name ?? ""} readOnly className="h-11 rounded-lg border border-input bg-eavi-muted px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Admission number (blank = auto)</label>
              <input name="admissionNo" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Intake</label>
              <select name="intakeId" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm">
                <option value="">—</option>
                {intakes.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Temporary password</label>
              <input name="password" type="text" required minLength={10} className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => setStep(2)} className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill">
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Parent / guardian & emergency contact</h2>

          <h3 className="text-base font-semibold">Parent / guardian</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Full name</label>
              <input name="guardianFullName" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Relationship</label>
              <select name="guardianRelationship" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm">
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Phone</label>
              <input name="guardianPhone" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Alternative phone</label>
              <input name="guardianAltPhone" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email</label>
              <input name="guardianEmail" type="email" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Occupation (optional)</label>
              <input name="guardianOccupation" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Residential address</label>
              <textarea name="guardianAddress" rows={2} className="rounded-lg border border-input bg-eavi-card px-3 py-2 text-sm" />
            </div>
          </div>

          <h3 className="text-base font-semibold">Emergency contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Full name</label>
              <input name="emergencyFullName" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Relationship</label>
              <input name="emergencyRelationship" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Primary phone</label>
              <input name="emergencyPhone" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Alternative phone</label>
              <input name="emergencyAltPhone" className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Residential address (optional)</label>
              <textarea name="emergencyAddress" rows={2} className="rounded-lg border border-input bg-eavi-card px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text">
              Previous
            </button>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill">
              Enrol student
            </button>
          </div>
        </div>
      )}
    </form>
  );
}