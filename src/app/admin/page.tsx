import { requireStaff } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const profile = await requireStaff();
  const { denied } = await searchParams;

  return (
    <div>
      <AdminHeader title="Dashboard" />
      <div className="px-8 py-6">
        {denied && (
          <div className="mb-4 rounded-lg bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
            You don&apos;t have permission to access <strong>{denied}</strong>.
          </div>
        )}
        <p className="text-dream-muted">
          Welcome back, {profile.name || "team"}. Order, production and proof queues will appear here.
        </p>
      </div>
    </div>
  );
}
