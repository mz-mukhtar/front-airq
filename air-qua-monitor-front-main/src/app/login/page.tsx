"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { validatePassword } from "@/lib/utils/password-validation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WeatherMark } from "@/components/WeatherMark";


export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, loginWithGoogle, signup } = useAuth();
  const router = useRouter();

  // Live password-policy check (mirrors the backend; backend re-validates).
  const pwCheck = useMemo(() => validatePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
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
          router.push("/");
        } else {
          setError("Sign up failed. Please try again.");
        }
      } else {
        const success = await login(email, password);
        if (success) {
          router.push("/");
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

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const success = await loginWithGoogle();
      if (success) router.push("/");
      else setError("Google login failed.");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-purple-50 to-emerald-50">
      {/* Decorative weather marks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-10 login-mark-left">
          <div className="login-float-slow">
            <WeatherMark className="w-[340px] h-[220px]" aria-hidden="true" focusable="false" />
          </div>
        </div>
        <div className="absolute -right-14 bottom-6 login-mark-right">
          <div className="login-float-fast">
            <WeatherMark className="w-[420px] h-[280px]" aria-hidden="true" focusable="false" />
          </div>
        </div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 login-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">Air Quality Monitor</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Air quality,{" "}
              <span className="bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                made visible.
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {isSignUp ? "Create your account to start tracking live stations." : "Sign in to monitor real‑time air quality data."}
            </p>
          </div>

          <Card className="w-full bg-white/80 backdrop-blur-md border border-purple-200 shadow-2xl rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-slate-900">
                {isSignUp ? "Create an Account" : "Welcome Back"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Join the air quality monitoring platform"
                  : "Sign in to monitor air quality data"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
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
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password</Label>
                  {!isSignUp && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-purple-700 hover:underline font-semibold"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignUp && password.length > 0 && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                    {pwCheck.requirements.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        {r.met ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={r.met ? "text-slate-600" : "text-slate-500"}>{r.label}</span>
                      </div>
                    ))}
                    {pwCheck.errors.map((e) => (
                      <div key={e} className="flex items-center gap-2 text-xs text-red-600">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Input
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
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordConfirm.length > 0 && password !== passwordConfirm && (
                    <p className="text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                  <div className="font-semibold mb-1">Registration Error:</div>
                  <div className="whitespace-pre-line">{error}</div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={
                  isLoading ||
                  (isSignUp && (!pwCheck.valid || password !== passwordConfirm))
                }
              >
                {isLoading
                  ? "Please wait..."
                  : isSignUp
                  ? "Create Account"
                  : "Access Air Quality Dashboard"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/80 backdrop-blur-md px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-purple-200 text-purple-700 font-bold bg-transparent hover:bg-purple-50"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              Continue with Google
            </Button>

            <div className="text-center text-sm">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setName("");
                  setPasswordConfirm("");
                }}
                className="text-purple-700 hover:underline font-semibold"
                disabled={isLoading}
                type="button"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-slate-500">
            Addis Ababa University · C40 Cities
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes login-slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 0.72;
            transform: translateX(0);
          }
        }
        @keyframes login-slide-in-right {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 0.65;
            transform: translateX(0);
          }
        }
        @keyframes login-fade-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes login-float-8 {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes login-float-10 {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .login-mark-left {
          opacity: 0.72;
          animation: login-slide-in-left 1.2s ease-out both;
        }
        .login-mark-right {
          opacity: 0.65;
          animation: login-slide-in-right 1.2s ease-out 0.2s both;
        }
        .login-float-slow {
          animation: login-float-8 7s ease-in-out infinite;
        }
        .login-float-fast {
          animation: login-float-10 6s ease-in-out 0.4s infinite;
        }
        .login-fade-up {
          animation: login-fade-up 0.8s ease-out both;
        }
      `}</style>
    </div>
  );
}
