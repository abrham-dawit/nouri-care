import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/ComingSoon";

export const metadata: Metadata = { title: "Caregiver Portal" };

export default function CaregiversPage() {
  return (
    <ComingSoon
      eyebrow="Family & caregivers"
      title="Caregiver Portal"
      phase="Phase 2"
      description="Calm, consented updates for the people who love the patient. Only information the patient has chosen to share."
      planned={[
        "Approved patient status updates",
        "Daily check-in reports",
        "Scheduled reminders",
        "Family communication settings",
        "Emergency contact preferences",
        "Consent-controlled sharing",
      ]}
    />
  );
}
