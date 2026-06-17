import { requireStaff } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toaster";

export const metadata = { title: "Admin — Dreamhouse Printing" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-dream-bg text-dream-ink">
        <AdminSidebar
          name={profile.name ?? profile.email ?? "Staff"}
          role={profile.role}
          permissions={profile.staff_permissions ?? []}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ToastProvider>
  );
}
