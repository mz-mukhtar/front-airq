"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { completePasswordReset } from "@/lib/api/auth";
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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing or invalid reset link. Please request a new one.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await completePasswordReset(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not reset your password. The link may have expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Reset your password
        </CardTitle>
        <CardDescription>
          {success
            ? "Your password has been updated."
            : "Choose a new password for your account."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {success ? (
          <div className="space-y-4">
            <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-md border border-emerald-200 dark:border-emerald-900/60">
              Password reset successful. You can now sign in with your new password.
            </div>
            <Link href="/login">
              <Button className="w-full">
                Go to login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-md border border-red-200 dark:border-red-900/60 whitespace-pre-line">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Please wait..." : "Reset password"}
            </Button>

            <div className="text-center text-sm">
              <Link href="/login" className="text-primary hover:underline font-semibold">
                Back to login
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
            <ResetPasswordForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>
    </div>
  );
}
