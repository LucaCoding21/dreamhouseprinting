import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Reset password | Dreamhouse Printing" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we’ll send a link to set a new one."
      footer={
        <span>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-dream-purple hover:underline">
            Back to log in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
