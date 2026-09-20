import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile, accountHomePath } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in | Dreamhouse Printing" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in? Don't show a password form, go where they were headed.
  // This also turns any spurious bounce to /login into an invisible round trip
  // instead of an apparent logout.
  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    const safe =
      next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
    redirect(safe ?? accountHomePath(profile));
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to track orders, approve proofs and reorder."
      footer={
        <span>
          New here?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-semibold text-dream-purple hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <LoginForm next={next ?? "/account"} />
    </AuthShell>
  );
}
