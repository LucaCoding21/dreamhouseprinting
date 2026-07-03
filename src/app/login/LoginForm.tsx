"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type AuthState } from "./actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" required>
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </Field>
      <Field label="Password" required>
        <PasswordInput name="password" autoComplete="current-password" placeholder="••••••••" required />
        <div className="mt-1 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-dream-purple hover:underline">
            Forgot password?
          </Link>
        </div>
      </Field>
      {state.error && (
        <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{state.error}</p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Log in
      </Button>
    </form>
  );
}
