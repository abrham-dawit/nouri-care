// Issues (or revokes) a credential for a physical Nouri device.
//
//   npm run device:issue -- nouri-001                    → new credential for nouri-001 (demo-patient-001)
//   npm run device:issue -- nouri-002 demo-patient-002   → map a device to another synthetic patient
//   npm run device:issue -- --revoke nouri-001
//
// The credential is printed ONCE. Only its SHA-256 hash is stored, in .data/devices.json (git-ignored).
// Put the credential in the device's local configuration (e.g. secrets.h, never committed), not in shared firmware.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, ".data", "devices.json");
const args = process.argv.slice(2);

const load = () => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { devices: [] });
const save = (data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
};

if (args[0] === "--revoke") {
  const id = args[1];
  const data = load();
  const n = data.devices.filter((d) => d.deviceId === id && !d.revoked).length;
  data.devices.forEach((d) => d.deviceId === id && (d.revoked = true));
  save(data);
  console.log(n ? `Revoked ${n} credential(s) for ${id}.` : `No active credential for ${id}.`);
  process.exit(0);
}

const deviceId = args[0];
const patientId = args[1] ?? "demo-patient-001";
if (!deviceId || !/^[a-z0-9-]{3,40}$/.test(deviceId)) {
  console.error("Usage: npm run device:issue -- <device-id> [patient-id]   (device id: lowercase letters, digits, dashes)");
  process.exit(1);
}
if (!/^demo-patient-00[1-6]$/.test(patientId)) {
  console.error(`Unknown patient "${patientId}". This prototype only has synthetic patients demo-patient-001 … demo-patient-006.`);
  process.exit(1);
}

const token = `nouri_dev_${randomBytes(32).toString("base64url")}`;
const data = load();
data.devices.forEach((d) => d.deviceId === deviceId && (d.revoked = true)); // one active credential per device
data.devices.push({ deviceId, patientId, tokenSha256: createHash("sha256").update(token).digest("hex"), issuedAt: new Date().toISOString() });
save(data);

console.log(`\nDevice ${deviceId} → ${patientId}`);
console.log("\nCredential (shown only once, store it on the device, never commit it):\n");
console.log(`  ${token}\n`);
console.log("Send it as:  Authorization: Bearer <credential>\n");
