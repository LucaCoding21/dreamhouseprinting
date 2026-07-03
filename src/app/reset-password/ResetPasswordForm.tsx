"use client";

import { useActionState } from "react";
import { updatePasswordAction, type AuthResult } from "@/app/login/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(updatePasswordAction, {});

  return (
    <form action={action} className="space-y-4">
      <Field label="New password" required hint="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
      </Field>
      {state.error && (
        <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{state.error}</p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Update password
      </Button>
    </form>
  );
}
