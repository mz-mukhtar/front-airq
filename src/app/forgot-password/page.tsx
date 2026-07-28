"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api/auth";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Always show the generic confirmation to prevent email enumeration
    } finally {
      setIsLoading(false);
      setSubmitted(true);
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
          </div>

          <Card className="w-full bg-card/90 backdrop-blur-md border border-sky-200 dark:border-sky-900/60 shadow-2xl rounded-2xl auth-enter-delayed">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Forgot your password?
              </CardTitle>
              <CardDescription>
                Enter your email and we will send you a reset link.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {submitted ? (
                <div className="space-y-4">
                  <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-md border border-emerald-200 dark:border-emerald-900/60">
                    If an account exists for that email, a password reset link has been
                    sent. Please check your inbox.
                  </div>
                  <Link href="/login">
                    <Button className="w-full">
                      Back to login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Please wait..." : "Send reset link"}
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

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>
    </div>
  );
}
