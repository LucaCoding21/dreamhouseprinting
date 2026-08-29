"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/use-toast";
import { updateProfileAction, updateNotificationPrefsAction } from "./actions";

export function AccountForm({
  initialName,
  initialPhone,
  email,
  emailNotifications,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  emailNotifications: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [emailNotif, setEmailNotif] = useState(emailNotifications);
  const [pending, start] = useTransition();

  function saveProfile() {
    start(async () => {
      const res = await updateProfileAction({ name, phone });
      if (res.error) toast({ title: "Save failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Profile saved", variant: "success" });
        router.refresh();
      }
    });
  }

  function setNotif(v: boolean) {
    setEmailNotif(v);
    start(async () => {
      const res = await updateNotificationPrefsAction({ email: v });
      if (res.error) toast({ title: "Save failed", description: res.error, variant: "error" });
      else toast({ title: "Preferences saved", variant: "success" });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Contact support to change your email.">
            <Input value={email} disabled />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Button variant="primary" loading={pending} onClick={saveProfile} className="w-full sm:w-auto">
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-dream-ink">Email updates</div>
              <p className="text-sm text-dream-muted">Order status, proof ready, and shipping notifications.</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setNotif} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
