"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
    <Card className="w-full max-w-sm gap-0 py-0">
      <CardHeader className="gap-2 px-6 pt-7 pb-4">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {result ? (
          <Alert>
            <AlertTitle>
              {result.status === "PENDING" ? "Registered, awaiting approval" : "Registered"}
            </AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Field>
              <FieldLabel htmlFor="reg-role">I am registering as</FieldLabel>
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
              <FieldError id="reg-role-error">{errors.role}</FieldError>
            </Field>

            {needsCampus && (
              <Field>
                <FieldLabel htmlFor="reg-campus">Campus</FieldLabel>
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
                <FieldError id="reg-campus-error">{errors.campusId}</FieldError>
              </Field>
            )}

            {!needsCampus && (
              <FieldDescription>
                Superadmins are not tied to one campus, and every admin request waits
                for the current superadmin to approve it.
              </FieldDescription>
            )}

            <Field>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
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
              <FieldError id="name-error">{errors.fullName}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="reg-email">Email address</FieldLabel>
              <Input
                id="reg-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={update("email")}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "reg-email-error" : undefined}
              />
              <FieldError id="reg-email-error">{errors.email}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
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
              <FieldError id="phone-error">{errors.phone}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="reg-password">Password</FieldLabel>
              <Input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={update("password")}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "reg-password-error" : undefined}
              />
              <FieldError id="reg-password-error">{errors.password}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={values.confirm}
                onChange={update("confirm")}
                aria-invalid={errors.confirm ? true : undefined}
                aria-describedby={errors.confirm ? "confirm-error" : undefined}
              />
              <FieldError id="confirm-error">{errors.confirm}</FieldError>
            </Field>

            {failure && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {failure}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={busy}>
              {busy && <Spinner data-icon="inline-start" />}
              {busy ? "Creating account" : "Create account"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
