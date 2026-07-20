import { requireStaff } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toaster";

export const metadata = { title: "Admin | Dreamhouse Printing" };

// Orders in these statuses need staff attention (proof or re-proof).
const ACTION_STATUSES = ["submitted", "in_review", "changes_requested"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth check and nav-badge count race in parallel; requireStaff redirects
  // non-staff before anything renders either way.
  const supabase = requireSupabaseServiceClient();
  const [profile, { count: actionCount }] = await Promise.all([
    requireStaff(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ACTION_STATUSES),
  ]);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-dream-bg text-dream-ink">
        <AdminSidebar
          name={profile.name ?? profile.email ?? "Staff"}
          role={profile.role}
          permissions={profile.staff_permissions ?? []}
          badges={{ "/admin/orders": actionCount ?? 0 }}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ToastProvider>
  );
}
