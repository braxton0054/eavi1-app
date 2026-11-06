"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BorderBeam } from "@/components/magicui/border-beam";
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
import { Label } from "@/components/ui/label";
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
    };
  }

  function validate(): boolean {
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
    if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }
    if (values.confirm !== values.password) {
      nextErrors.confirm = "The two passwords do not match.";
    }
    if (needsCampus && campusId === null) {
      nextErrors.campusId = "Choose which campus you belong to.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    if (!validate()) return;

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
        if (data.fieldErrors) setErrors({ ...EMPTY, ...data.fieldErrors });
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
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="reg-role">I am registering as</Label>
                <Select
                  value={role}
                  onValueChange={(next) => {
                    setRole(next);
                    setErrors((current) => ({ ...current, campusId: undefined }));
                  }}
                >
                  <SelectTrigger id="reg-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm font-medium text-destructive">{errors.role}</p>
                )}
              </div>

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

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  value={values.password}
                  onChange={update("password")}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "reg-password-error" : undefined}
                />
                {errors.password && (
                  <p id="reg-password-error" className="text-sm font-medium text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
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
          <ShimmerButton asChild>
            <Link href="/login">Login</Link>
          </ShimmerButton>
          <ShimmerButton type="submit" form="register-form" disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? "Creating account" : "Register"}
          </ShimmerButton>
        </CardFooter>
      )}

      <BorderBeam
        duration={4}
        size={300}
        reverse
        className="from-transparent via-green-500 to-transparent"
      />
    </Card>
  );
}
