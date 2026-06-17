import { getProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AccountSettingsPage() {
  const profile = await getProfile();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dream-ink">Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dream-muted">Name</span>
            <span className="text-dream-ink">{profile?.name || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dream-muted">Email</span>
            <span className="text-dream-ink">{profile?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dream-muted">Phone</span>
            <span className="text-dream-ink">{profile?.phone || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
