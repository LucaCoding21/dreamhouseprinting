import { requireStaff } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toaster";

export const metadata = { title: "Admin | Dreamhouse Printing" };

// Orders in these statuses need staff attention in the proofing queue.
const PROOF_ACTION_STATUSES = ["submitted", "in_review", "changes_requested"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();

  // Count of orders awaiting a proof / staff action, surfaced as a nav badge.
  const supabase = requireSupabaseServiceClient();
  const { count: proofCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", PROOF_ACTION_STATUSES);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-dream-bg text-dream-ink">
        <AdminSidebar
          name={profile.name ?? profile.email ?? "Staff"}
          role={profile.role}
          permissions={profile.staff_permissions ?? []}
          badges={{ "/admin/proofs": proofCount ?? 0 }}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ToastProvider>
  );
}
