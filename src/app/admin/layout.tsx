import { requireStaff } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
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
      {/* The nav bar is pinned and the page body is its own scroll container.
          That keeps every `sticky top-0` header inside a route (order command
          header, AdminHeader) pinned directly under the nav without any of
          them needing to know how tall the nav is. */}
      <div className="flex h-dvh flex-col overflow-hidden bg-dream-bg text-dream-ink">
        <AdminTopBar
          name={profile.name ?? profile.email ?? "Staff"}
          role={profile.role}
          permissions={profile.staff_permissions ?? []}
          badges={{ "/admin/orders": actionCount ?? 0 }}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </ToastProvider>
  );
}
