export type NavItem = { href: string; label: string; description: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/companion", label: "Talk to Nouri", description: "The patient's conversation with Nouri" },
  { href: "/dashboard", label: "Dashboard", description: "Clinician overview of patients and trends" },
  { href: "/patients", label: "Patients", description: "Profiles, journals and visit briefs" },
  { href: "/caregivers", label: "Caregivers", description: "Consented updates for family" },
  { href: "/agents", label: "Agents", description: "The 30-agent control center" },
  { href: "/voice", label: "Voice Studio", description: "Configure how Nouri sounds" },
  { href: "/settings", label: "Settings", description: "Permissions, devices and privacy" },
];

export const MISSION = "Care that remembers. Companionship that matters.";
