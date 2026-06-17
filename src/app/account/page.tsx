import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function AccountDashboardPage() {
  const profile = await getProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-dream-ink">
          Hi {profile?.name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-dream-muted">Track your orders, approve proofs, and start new designs.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <p className="text-dream-muted">You have no active orders yet.</p>
          <Link href="/shop">
            <Button variant="primary">Start a design</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
