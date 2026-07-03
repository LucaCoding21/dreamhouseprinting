"use client";

import { useActionState } from "react";
import { signUpAction } from "@/app/login/actions";
import type { AuthState } from "@/app/login/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" required>
        <Input name="name" type="text" autoComplete="name" placeholder="Jordan Lee" required />
      </Field>
      <Field label="Email" required>
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </Field>
      <Field label="Phone" hint="Optional — helps us reach you about your order.">
        <Input name="phone" type="tel" autoComplete="tel" placeholder="(604) 555-0123" />
      </Field>
      <Field label="Password" required hint="At least 8 characters.">
        <PasswordInput name="password" autoComplete="new-password" placeholder="••••••••" required minLength={8} />
      </Field>
      {state.error && (
        <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{state.error}</p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}
