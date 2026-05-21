"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NaradaLogo from "@/components/brand/NaradaLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { login } from "@/lib/auth/actions";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Theme toggle in the top-right so you can sanity-check both modes */}
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div
        className="w-full max-w-[400px] rounded-xl border p-8"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <NaradaLogo size="lg" />
          <p
            className="text-xs mt-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Lead intelligence for Celmor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@celmor.co.uk"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
          </div>

          {error && (
            <p
              className="text-sm"
              style={{ color: "var(--status-danger)" }}
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "#FFFFFF",
            }}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
