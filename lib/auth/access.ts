/**
 * Who may open what. Shared by proxy.ts (every page request) and the API routes (every data
 * request), so the rules live in one place. Client-safe: no secrets.
 */

export type Role = "patient" | "family" | "clinician";

export type SessionUser = {
  uid: string;
  name: string;
  role: Role;
  /** Patients this account may see. Verified clinicians see everyone (see canAccessPatient). */
  patientIds: string[];
  verified: boolean;
};

export const ROLE_LABEL: Record<Role, string> = { patient: "Patient", family: "Family / guardian", clinician: "Doctor / nurse" };

export function canAccessPatient(user: SessionUser, patientId: string) {
  if (user.role === "clinician") return user.verified;
  return user.patientIds.includes(patientId);
}

/** Where an account lands after logging in. */
export function homeFor(user: SessionUser): string {
  if (user.role === "clinician") return user.verified ? "/dashboard" : "/account-pending";
  if (user.role === "patient") return "/companion";
  return user.patientIds[0] ? `/patients/${user.patientIds[0]}` : "/account-pending";
}

/** Pages anyone can open, signed in or not. */
export const PUBLIC_PATHS = ["/login", "/signup"];

/** Page sections each role may open (a patient page is also checked against the patient id). */
const ROLE_PAGES: Record<Role, string[]> = {
  patient: ["/companion", "/voice", "/settings", "/patients/"],
  family: ["/caregivers", "/settings", "/patients/"],
  clinician: ["/dashboard", "/patients", "/companion", "/caregivers", "/agents", "/voice", "/settings"],
};

const inSection = (path: string, section: string) => (section.endsWith("/") ? path.startsWith(section) : path === section || path.startsWith(`${section}/`));

export function canOpenPage(user: SessionUser, path: string): boolean {
  if (path === "/account-pending") return true;
  if (user.role === "clinician" && !user.verified) return path === "/settings";
  if (!ROLE_PAGES[user.role].some((s) => inSection(path, s))) return false;
  const patient = path.match(/^\/patients\/([^/]+)/)?.[1];
  return patient ? canAccessPatient(user, decodeURIComponent(patient)) : true;
}

/** Navigation entries shown to a role (UI only; proxy.ts enforces access). */
export function navFor(user: SessionUser | null): string[] {
  if (!user) return [];
  if (user.role === "clinician") return user.verified ? ROLE_PAGES.clinician : ["/settings"];
  if (user.role === "patient") return ["/companion", "/voice", "/settings"];
  return ["/settings"];
}
