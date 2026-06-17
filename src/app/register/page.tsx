import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create account — Dreamhouse Printing" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Save designs, track orders and reorder in a click."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-dream-purple hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <RegisterForm next={next ?? "/account"} />
    </AuthShell>
  );
}
