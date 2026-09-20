import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Set a new password | Dreamhouse Printing" };

export default async function ResetPasswordPage() {
  // The /auth/confirm recovery link establishes a session before landing here.
  // No session means a direct visit or an expired link -> nothing to reset.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This reset link is no longer valid."
        footer={
          <span>
            <Link href="/forgot-password" className="font-semibold text-dream-purple hover:underline">
              Request a new link
            </Link>
          </span>
        }
      >
        <p className="text-sm text-dream-muted">
          Password reset links expire after an hour and can only be used once. Request a fresh one to
          continue.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Pick something at least 8 characters long.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
