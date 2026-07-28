"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { checkInvitation, registerWithInvitation } from "@/lib/api/waitlist";
import { useAuthStore } from "@/store/authStore";
import { resolvePostLoginRoute } from "@/lib/auth-redirect";
import { validatePassword } from "@/lib/utils/password-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthAtmosphere } from "@/components/auth/AuthAtmosphere";
import { LoadingState } from "@/components/ui/loading-state";
import { Check, Eye, EyeOff, X } from "lucide-react";
import type { InvitationCheck } from "@/lib/api/types";

/**
 * Account creation from an admin-issued invitation link.
 *
 * The link is the authorization: the email is fixed by the invitation and this
 * page never lets it be edited, because a redeemer who could choose a different
 * address would make the admin's approval meaningless. The backend enforces the
 * same rule — this only avoids showing a field that would be ignored.
 */
function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const destination = resolvePostLoginRoute(searchParams.get("next"));

  const login = useAuthStore((state) => state.login);

  const [invitation, setInvitation] = useState<InvitationCheck | null>(null);
  // A missing token is knowable at first render, so it is seeded here rather
  // than set from the effect — there is nothing to check and no reason to
  // flash a spinner first.
  const [checking, setChecking] = useState(Boolean(token));
  const [invitationError, setInvitationError] = useState(
    token
      ? ""
      : "This page needs a registration link. Ask an administrator to send you one."
  );

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pwCheck = useMemo(() => validatePassword(password), [password]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    checkInvitation(token)
      .then((data) => {
        if (cancelled) return;
        setInvitation(data);
        setName(data.name || "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInvitationError(
          err instanceof Error && err.message
            ? err.message
            : "This registration link is invalid, expired, or has already been used."
        );
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!pwCheck.valid) {
      setError(
        pwCheck.errors[0] ??
          "Password must be 12+ characters with an uppercase letter, a lowercase letter, a number, and a special character."
      );
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithInvitation({
        token,
        name: name.trim(),
        password,
        password_confirm: passwordConfirm,
      });

      // The account exists now, so a failed sign-in here is a session problem,
      // not a registration one — send them to /login rather than implying the
      // account was not created.
      const signedIn = invitation
        ? await login(invitation.email, password)
        : false;
      router.push(signedIn ? destination : "/login");
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not create your account. The link may have expired."
      );
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
        <CardContent className="py-10">
          <LoadingState
            variant="inline"
            message="Checking your invitation"
            hint="This only takes a moment"
          />
        </CardContent>
      </Card>
    );
  }

  if (invitationError || !invitation) {
    return (
      <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Link not usable
          </CardTitle>
          <CardDescription>This registration link cannot be used.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
            {invitationError}
          </div>
          <p className="text-sm text-muted-foreground">
            Registration links are single-use and expire. If yours has run out,
            ask an administrator to issue a new one.
          </p>
          <Link href="/login">
            <Button className="w-full">Back to sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Set up your account
        </CardTitle>
        <CardDescription>
          Your request was approved — choose a password to finish.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invited-email">Email</Label>
            <Input
              id="invited-email"
              type="email"
              value={invitation.email}
              readOnly
              disabled
              className="bg-muted/60"
            />
            <p className="text-xs text-muted-foreground">
              Fixed by your invitation. Contact an administrator to use a
              different address.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-name">Name</Label>
            <Input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
              placeholder="Abebe Bekele"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="space-y-1 rounded-md border border-border bg-muted/60 p-2.5">
                {pwCheck.requirements.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.met ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={r.met ? "text-foreground/80" : "text-muted-foreground"}>
                      {r.label}
                    </span>
                  </div>
                ))}
                {pwCheck.errors.map((e) => (
                  <div
                    key={e}
                    className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password-confirm">Confirm password</Label>
            <div className="relative">
              <Input
                id="register-password-confirm"
                type={showPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isSubmitting}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordConfirm.length > 0 && password !== passwordConfirm && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Passwords do not match
              </p>
            )}
          </div>

          {error && (
            <div className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting || !pwCheck.valid || password !== passwordConfirm
            }
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>

          <div className="text-center text-sm">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <AuthAtmosphere />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 auth-enter">
            {/* Brand mark on the auth pages links back to the public site. */}
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-primary transition-opacity hover:opacity-80"
            >
              Addis Air Net
            </Link>
          </div>
          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>
    </div>
  );
}
