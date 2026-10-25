import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/ComingSoon";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      eyebrow="Configuration"
      title="Settings"
      phase="a later phase"
      description="Permissions, devices and privacy, with the patient's consent at the centre."
      planned={[
        "Patient and caregiver permissions",
        "Device connectivity",
        "Privacy controls",
        "Accessibility preferences",
        "Notification settings",
      ]}
    />
  );
}
