"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NaradaLogo from "@/components/brand/NaradaLogo";
import { signup } from "@/lib/auth/actions";

export default function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const password = formData.get("password") as string;
    const confirm = formData.get("confirm_password") as string;
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await signup(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-base)]">
      <div className="w-full max-w-[400px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <NaradaLogo size="lg" />
          <p className="text-xs mt-4 text-[var(--text-secondary)]">
            Create your Narada account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              autoComplete="name"
              placeholder="Devansh"
              required
              disabled={isPending}
            />
          </div>

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
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--status-danger)]">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-xs text-[var(--text-secondary)] mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--accent-primary)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
