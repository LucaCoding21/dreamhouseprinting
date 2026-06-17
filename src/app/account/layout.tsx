import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { PortalNav } from "@/components/portal/PortalNav";
import { ToastProvider } from "@/components/ui/Toaster";

export const metadata = { title: "My Account — Dreamhouse Printing" };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");

  // Staff use the admin portal; send them there if they land on /account by accident.
  // (They can still view customer pages, but their home is /admin.)
  return (
    <ToastProvider>
      <div className="min-h-screen bg-dream-cream">
        <PortalNav name={profile.name ?? profile.email ?? "My account"} />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
