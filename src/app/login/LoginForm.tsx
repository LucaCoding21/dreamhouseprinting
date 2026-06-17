"use client";

import { useActionState } from "react";
import { signInAction, type AuthState } from "./actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
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
        <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
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
