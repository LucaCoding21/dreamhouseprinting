import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/auth";
import { claimGuestRecords } from "@/lib/claim";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { ToastProvider } from "@/components/ui/Toaster";

export const metadata = { title: "My Account | Dreamhouse Printing" };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");

  // Self-heal: attach any guest orders/designs missed by the auth-time claim.
  // Cheap idempotent UPDATEs scoped to still-unclaimed rows. Email is taken from
  // the authenticated user object, never client input.
  const user = await getUser();
  if (user?.email) await claimGuestRecords(user.id, user.email);

  const name = profile.name ?? profile.email ?? "My account";

  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-[#f8f7fd]">
        <PortalSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PortalTopbar name={name} />
          <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
