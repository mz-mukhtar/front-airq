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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-purple-50 to-emerald-50">
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
              Air Quality Monitor
            </p>
          </div>

          <Card className="w-full bg-white/80 backdrop-blur-md border border-purple-200 shadow-2xl rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-slate-900">
                Forgot your password?
              </CardTitle>
              <CardDescription>
                Enter your email and we will send you a reset link.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {submitted ? (
                <div className="space-y-4">
                  <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200">
                    If an account exists for that email, a password reset link has been
                    sent. Please check your inbox.
                  </div>
                  <Link href="/login">
                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                      Back to login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Please wait..." : "Send reset link"}
                  </Button>

                  <div className="text-center text-sm">
                    <Link href="/login" className="text-purple-700 hover:underline font-semibold">
                      Back to login
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>
    </div>
  );
}
