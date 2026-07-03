"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type AuthResult } from "@/app/login/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.done) {
    return (
      <div className="rounded-xl border border-dream-line bg-dream-cream px-4 py-5 text-center">
        <p className="font-display text-base font-bold text-dream-ink">Check your inbox</p>
        <p className="mt-1.5 text-sm text-dream-muted">
          If that email has an account, a reset link is on its way. It expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" required>
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </Field>
      {state.error && (
        <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{state.error}</p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
