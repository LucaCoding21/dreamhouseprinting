import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in | Dreamhouse Printing" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to track orders, approve proofs and reorder."
      footer={
        <span>
          New here?{" "}
          <Link href="/register" className="font-semibold text-dream-purple hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <LoginForm next={next ?? "/account"} />
    </AuthShell>
  );
}
