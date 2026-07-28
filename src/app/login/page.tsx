"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePostLoginRoute } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X, MailCheck } from "lucide-react";
import { validatePassword } from "@/lib/utils/password-validation";
import { getSignupConfig, joinWaitlist } from "@/lib/api/waitlist";
import type { SignupMode } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthAtmosphere } from "@/components/auth/AuthAtmosphere";


function LoginPageContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Invite-only signup: an admin can close open registration, in which case the
  // sign-up tab collects an access request instead of creating an account.
  // Starts null so nothing renders a form that the server would reject — the
  // sign-in half of this page is usable either way and never waits on it.
  const [signupMode, setSignupMode] = useState<SignupMode | null>(null);
  const [organization, setOrganization] = useState("");
  const [reason, setReason] = useState("");
  const [waitlistMessage, setWaitlistMessage] = useState("");

  const isWaitlist = signupMode === "waitlist";
  // The sign-up tab under invite-only signup: an access request, not an account.
  const isAccessRequest = isSignUp && isWaitlist;

  const { login, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where the middleware wanted us to end up before it bounced us here.
  const destination = resolvePostLoginRoute(searchParams.get("next"));

  // Live password-policy check (mirrors the backend; backend re-validates).
  const pwCheck = useMemo(() => validatePassword(password), [password]);

  useEffect(() => {
    let cancelled = false;
    getSignupConfig()
      .then((config) => {
        if (!cancelled) setSignupMode(config.signup_mode);
      })
      .catch(() => {
        // Unreachable config is not a reason to block sign-in. Assume the
        // stricter mode: offering a sign-up form that 403s is worse than
        // offering a request form an admin can act on.
        if (!cancelled) setSignupMode("waitlist");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp && isWaitlist) {
        if (!name.trim()) {
          setError("Name is required");
          setIsLoading(false);
          return;
        }
        const response = await joinWaitlist({
          name: name.trim(),
          email,
          organization: organization.trim() || undefined,
          reason: reason.trim() || undefined,
        });
        setWaitlistMessage(
          response.message ||
            "Your request has been received. If it is approved, a registration link will be sent to your email address."
        );
      } else if (isSignUp) {
        if (!name.trim()) {
          setError("Name is required");
          setIsLoading(false);
          return;
        }
        if (!pwCheck.valid) {
          setError(
            pwCheck.errors[0] ??
              "Password must be 12+ characters with an uppercase letter, a lowercase letter, a number, and a special character."
          );
          setIsLoading(false);
          return;
        }
        if (password !== passwordConfirm) {
          setError("Passwords do not match");
          setIsLoading(false);
          return;
        }
        const success = await signup(name, email, password, passwordConfirm);
        if (success) {
          router.push(destination);
        } else {
          setError("Sign up failed. Please try again.");
        }
      } else {
        const success = await login(email, password);
        if (success) {
          router.push(destination);
        } else {
          setError("Invalid email or password.");
        }
      }
    } catch (err: any) {
      // Extract error message from ApiException or other errors
      let errorMessage = "An error occurred. Please try again.";

      // Check if it's an ApiException with validation errors
      if (err?.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        // Format validation errors for display
        const errorMessages = err.errors.map((validationErr: any) => {
          // Extract field name from location (e.g., ["body", "password"] -> "password")
          const field = validationErr.loc && validationErr.loc.length > 0
            ? String(validationErr.loc[validationErr.loc.length - 1]).replace(/_/g, ' ')
            : 'field';
          // Capitalize first letter
          const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
          return `${fieldName}: ${validationErr.msg || validationErr.message || 'Invalid value'}`;
        });
        errorMessage = errorMessages.join('\n');
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err?.detail) {
        errorMessage = err.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      console.error("Login/Signup error:", errorMessage);
      if (err?.originalError) {
        console.error("Original error:", err.originalError);
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Air quality,{" "}
              <span className="bg-gradient-to-r from-sky-600 to-emerald-600 dark:from-sky-400 dark:to-emerald-400 bg-clip-text text-transparent">
                made visible.
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {isAccessRequest
                ? "Ask for access and we'll email you a registration link once it's approved."
                : isSignUp
                ? "Create your account to start tracking live stations."
                : "Sign in to monitor real‑time air quality data."}
            </p>
          </div>

          <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {waitlistMessage
                  ? "Request Received"
                  : isAccessRequest
                  ? "Request Access"
                  : isSignUp
                  ? "Create an Account"
                  : "Welcome Back"}
              </CardTitle>
              <CardDescription>
                {waitlistMessage
                  ? "You're on the waiting list"
                  : isAccessRequest
                  ? "Accounts are approved by an administrator"
                  : isSignUp
                  ? "Join the air quality monitoring platform"
                  : "Sign in to monitor air quality data"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {waitlistMessage ? (
                /*
                  Terminal state on purpose: there is nothing further for the
                  requester to do here, and re-showing the form would invite a
                  second submission that changes nothing.
                */
                <div className="space-y-4">
                  <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                    <MailCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      {waitlistMessage}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When an administrator approves your request you&apos;ll receive a
                    one-time registration link to set your password. No account
                    exists until you use it.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setWaitlistMessage("");
                      setIsSignUp(false);
                      setName("");
                      setOrganization("");
                      setReason("");
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
              <>
              <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    required={isSignUp}
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {isAccessRequest && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="organization">
                      Organisation{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="organization"
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      disabled={isLoading}
                      placeholder="Addis Ababa University"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">
                      Why do you need access?{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={isLoading}
                      rows={3}
                      maxLength={1000}
                      placeholder="Researching PM2.5 exposure near Bole."
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Context helps an administrator decide faster.
                    </p>
                  </div>
                </>
              )}

              {!isAccessRequest && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignUp && password.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/60 p-2.5 space-y-1">
                    {pwCheck.requirements.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        {r.met ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={r.met ? "text-foreground/80" : "text-muted-foreground"}>{r.label}</span>
                      </div>
                    ))}
                    {pwCheck.errors.map((e) => (
                      <div key={e} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {isSignUp && !isAccessRequest && (
                <div className="space-y-2">
                  <Label htmlFor="password-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="password-confirm"
                      type={showPassword ? "text" : "password"}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      disabled={isLoading}
                      required={isSignUp}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordConfirm.length > 0 && password !== passwordConfirm && (
                    <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
                  )}
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-md border border-red-200 dark:border-red-900/60">
                  <div className="font-semibold mb-1">
                    {isAccessRequest
                      ? "Request Error:"
                      : isSignUp
                      ? "Registration Error:"
                      : "Sign-in Error:"}
                  </div>
                  <div className="whitespace-pre-line">{error}</div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  (isSignUp &&
                    !isAccessRequest &&
                    (!pwCheck.valid || password !== passwordConfirm))
                }
              >
                {isLoading
                  ? "Please wait..."
                  : isAccessRequest
                  ? "Request Access"
                  : isSignUp
                  ? "Create Account"
                  : "Access Air Quality Dashboard"}
              </Button>
            </form>

            {/*
              Hidden until the signup mode is known: the tab label is the only
              thing telling someone whether they can sign up or must ask, and
              guessing wrong then correcting itself reads as a broken page.
            */}
            {signupMode !== null && (
              <div className="text-center text-sm">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                    setName("");
                    setPassword("");
                    setPasswordConfirm("");
                    setOrganization("");
                    setReason("");
                  }}
                  className="text-primary hover:underline font-semibold"
                  disabled={isLoading}
                  type="button"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : isWaitlist
                    ? "Need an account? Request access"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            )}
            </>
            )}
            </CardContent>
          </Card>

          {/*
            An account is not required to see the air quality. Someone who
            landed on the login wall should be told that rather than bouncing.
          */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account needed to view the live map —{" "}
            <Link href="/#map" className="font-semibold text-primary hover:underline">
              open it
            </Link>{" "}
            or{" "}
            <Link
              href="/getting-started"
              className="font-semibold text-primary hover:underline"
            >
              read the guide
            </Link>
            .
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>
    </div>
  );
}

// useSearchParams (for ?next=) needs a Suspense boundary to keep this route
// statically renderable.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative overflow-hidden bg-background">
          <AuthAtmosphere />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
