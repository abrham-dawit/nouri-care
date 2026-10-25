/**
 * Demo accounts and sign-up codes for the synthetic patients. Public on purpose: judges need them
 * to try each role, and all patient data in this project is synthetic. A real deployment would
 * issue codes per person from the clinic and never ship passwords in source.
 */

import type { Role } from "./access";

export type DemoAccount = { username: string; password: string; displayName: string; role: Role; patientIds: string[]; verified: boolean };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: "margaret", password: "nouri-patient-demo", displayName: "Margaret Ellis", role: "patient", patientIds: ["demo-patient-001"], verified: true },
  { username: "sarah", password: "nouri-family-demo", displayName: "Sarah Ellis", role: "family", patientIds: ["demo-patient-001"], verified: true },
  { username: "dr.raman", password: "nouri-doctor-demo", displayName: "Dr. Priya Raman", role: "clinician", patientIds: [], verified: true },
];

/** Patient sign-up: the clinic gives each patient an enrollment code that links the account to their record. */
export const ENROLLMENT_CODES: Record<string, string> = {
  "ENROLL-WALT-2026": "demo-patient-002",
  "ENROLL-ROSA-2026": "demo-patient-003",
  "ENROLL-HAROLD-2026": "demo-patient-004",
  "ENROLL-EVIE-2026": "demo-patient-005",
  "ENROLL-FRANK-2026": "demo-patient-006",
};

/** Family sign-up: a patient shares an invite code with the relatives they choose. */
export const FAMILY_INVITE_CODES: Record<string, string> = {
  "FAMILY-MARGARET-2026": "demo-patient-001",
  "FAMILY-WALT-2026": "demo-patient-002",
  "FAMILY-ROSA-2026": "demo-patient-003",
  "FAMILY-HAROLD-2026": "demo-patient-004",
  "FAMILY-EVIE-2026": "demo-patient-005",
  "FAMILY-FRANK-2026": "demo-patient-006",
};
