import { getProfile } from "@/lib/auth";
import { AccountForm } from "./AccountForm";

export default async function AccountSettingsPage() {
  const profile = await getProfile();
  const prefs = (profile?.notification_preferences ?? {}) as unknown as { email?: boolean };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dream-ink">Account</h1>
      <AccountForm
        initialName={profile?.name ?? ""}
        initialPhone={profile?.phone ?? ""}
        email={profile?.email ?? ""}
        emailNotifications={prefs.email !== false}
      />
    </div>
  );
}
