"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";

type Errors = Partial<
  Record<
    "fullName" | "email" | "phone" | "password" | "confirm" | "role" | "campusId",
    string
  >
>;

type CampusOption = { id: number; code: string; name: string; place: string };

const ROLES = [
  { value: "STUDENT", label: "Student" },
  { value: "TUTOR", label: "Tutor" },
  { value: "CAMPUS_ADMIN", label: "Campus admin" },
  { value: "SUPERADMIN", label: "Superadmin" },
];

/** Students and staff both hang off a campus; only the superadmin spans all three. */
const CAMPUS_ROLES = ["STUDENT", "TUTOR", "CAMPUS_ADMIN"];

const EMPTY: Errors = {};

export function RegisterForm() {
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [role, setRole] = useState("STUDENT");
  const [campusId, setCampusId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [errors, setErrors] = useState<Errors>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(
    null,
  );
  const [failure, setFailure] = useState("");
  /* FRM-20: three short steps — account type, details, password — so no screen is a long
     list, and the password step gets the focused, spacious treatment. Values stay mounted
     across steps, so going back never loses input. */
  const [step, setStep] = useState(1);

  useEffect(() => {
    let active = true;

    fetch("/api/campuses")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CampusOption[]) => {
        if (active) setCampuses(data);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const needsCampus = CAMPUS_ROLES.includes(role);

  function update(key: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      // FRM-09: a field's error clears as soon as the person edits it, instead of
      // nagging while they are already fixing it.
      setErrors((current) => ({ ...current, [key]: undefined }));
    };
  }

  function validateStep1(): boolean {
    const nextErrors: Errors = {};

    if (needsCampus && campusId === null) {
      nextErrors.campusId = "Choose which campus you belong to.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateStep2(): boolean {
    const nextErrors: Errors = {};

    if (values.fullName.trim().length < 2) {
      nextErrors.fullName = "Give the name we should call you by.";
    }
    if (!isEmail(values.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!values.phone.trim()) {
      nextErrors.phone = "We reach new students by phone first.";
    } else if (!normalizeKenyanPhone(values.phone)) {
      nextErrors.phone = "Use a Kenyan number, for example 0712 345 678.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateStep3(): boolean {
    const nextErrors: Errors = {};

    if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }
    if (values.confirm !== values.password) {
      nextErrors.confirm = "The two passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    // Enter inside a field advances the current step instead of submitting early.
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateStep2()) setStep(3);
      return;
    }
    if (!validateStep3()) return;

    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          role,
          campusId,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors({ ...EMPTY, ...data.fieldErrors });
          // A campus rejection belongs to step 1, so take the person back to it.
          if (data.fieldErrors.campusId) setStep(1);
        }
        setFailure(
          data.error ?? data.fieldErrors?.email ?? "We could not save that. Try again.",
        );
        return;
      }

      setResult({ status: data.status, message: data.message });
    } catch {
      setFailure("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative w-full max-w-[350px] overflow-hidden">
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Enter your details to create your account.</CardDescription>
      </CardHeader>

      <CardContent>
        {result ? (
          <Alert>
            <AlertTitle>
              {result.status === "PENDING" ? "Registered, awaiting approval" : "Registered"}
            </AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : (
          <form id="register-form" onSubmit={handleSubmit} noValidate>
            {/* NAV-17/CMP-04: progress with labels, exposed to assistive tech. */}
            <div className="mb-4">
              <p aria-live="polite" className="text-xs font-medium text-eavi-muted-text">
                Step {step} of 3 · {step === 1 ? "Account type" : step === 2 ? "Your details" : "Choose a password"}
              </p>
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step}
                aria-label="Registration progress"
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-eavi-muted"
              >
                <div
                  className="h-full rounded-full bg-eavi-fill transition-[width] duration-300"
                  style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
                />
              </div>
            </div>

            <div className={step === 1 ? "grid w-full items-center gap-4" : "hidden"}>
              {/* FRM-02: the account type is the step's one decision, so all four options sit
                  visible as radios instead of hidden behind a dropdown tap. */}
              <fieldset className="flex flex-col space-y-1.5">
                <legend className="text-sm font-medium">I am registering as</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-eavi-card px-3 text-sm font-medium text-eavi-on-bg transition-colors has-[:checked]:border-eavi-fill has-[:checked]:bg-eavi-primary-soft has-[:checked]:text-eavi-primary-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={role === option.value}
                        onChange={() => {
                          setRole(option.value);
                          setErrors((current) => ({ ...current, campusId: undefined }));
                        }}
                        className="size-5 accent-eavi-fill"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.role && (
                  <p className="text-sm font-medium text-destructive">{errors.role}</p>
                )}
              </fieldset>

              {needsCampus && (
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="reg-campus">Campus</Label>
                  <Select
                    value={campusId === null ? undefined : String(campusId)}
                    onValueChange={(next) => setCampusId(Number(next))}
                  >
                    <SelectTrigger id="reg-campus" className="w-full">
                      <SelectValue placeholder="Choose a campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {campuses.length === 0 ? (
                        <SelectItem value="__unavailable" disabled>
                          Campus list unavailable
                        </SelectItem>
                      ) : (
                        campuses.map((campus) => (
                          <SelectItem key={campus.id} value={String(campus.id)}>
                            {campus.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.campusId && (
                    <p id="reg-campus-error" className="text-sm font-medium text-destructive">
                      {errors.campusId}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 stays mounted but hidden, so nothing the person typed is lost on Back. */}
            <div className={step === 2 ? "grid w-full items-center gap-4" : "hidden"}>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Amos Kemboi"
                  value={values.fullName}
                  onChange={update("fullName")}
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={errors.fullName ? "name-error" : undefined}
                />
                {errors.fullName && (
                  <p id="name-error" className="text-sm font-medium text-destructive">
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={values.email}
                  onChange={update("email")}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "reg-email-error" : undefined}
                />
                {errors.email && (
                  <p id="reg-email-error" className="text-sm font-medium text-destructive">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  value={values.phone}
                  onChange={update("phone")}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-sm font-medium text-destructive">
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Step 3 is the focused password screen: two fields, generous space, nothing
                else competing for attention. Still mounted while hidden, so Back keeps
                everything. */}
            <div className={step === 3 ? "grid w-full items-center gap-4" : "hidden"}>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <PasswordInput
                  id="reg-password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  value={values.password}
                  onChange={update("password")}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "reg-password-error" : "reg-password-hint"}
                />
                {/* FRM-17/19: the rule is visible before typing, not only after a failed submit. */}
                <p id="reg-password-hint" className="text-xs text-eavi-muted-text">
                  Use at least 8 characters.
                </p>
                {errors.password && (
                  <p id="reg-password-error" className="text-sm font-medium text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  name="confirm"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={values.confirm}
                  onChange={update("confirm")}
                  aria-invalid={errors.confirm ? true : undefined}
                  aria-describedby={errors.confirm ? "confirm-error" : undefined}
                />
                {errors.confirm && (
                  <p id="confirm-error" className="text-sm font-medium text-destructive">
                    {errors.confirm}
                  </p>
                )}
              </div>
            </div>

            {failure && (
              <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                {failure}
              </p>
            )}
          </form>
        )}
      </CardContent>

      {!result && (
        <CardFooter className="flex justify-between">
          {step === 1 ? (
            <>
              {/* CMP-11: the step's action is primary; reaching the login page is quiet. */}
              <Button asChild variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
              <ShimmerButton
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                disabled={busy}
              >
                Continue
              </ShimmerButton>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
              >
                ← Back
              </Button>
              {step === 2 ? (
                <ShimmerButton
                  type="button"
                  onClick={() => {
                    if (validateStep2()) setStep(3);
                  }}
                  disabled={busy}
                >
                  Continue
                </ShimmerButton>
              ) : (
                <ShimmerButton type="submit" form="register-form" disabled={busy}>
                  {busy && <Spinner data-icon="inline-start" />}
                  {busy ? "Creating account" : "Create account"}
                </ShimmerButton>
              )}
            </>
          )}
        </CardFooter>
      )}
      {!result && step === 3 && (
        <p
          style={{
            marginBlockStart: "var(--space-2)",
            fontSize: "var(--text-xs)",
            lineHeight: 1.5,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          By creating an account you agree to the{" "}
          <Link href="/terms">terms of use</Link> and the{" "}
          <Link href="/privacy">privacy notice</Link>.
        </p>
      )}
    </Card>
  );
}
