import "server-only";

/**
 * Accounts, stored in .data/users.json (git-ignored) with scrypt password hashes. The demo accounts
 * are created the first time the file is needed. Prototype storage: a real deployment needs a
 * database, rate-limited login, password reset and audit logs.
 */

import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { Role, SessionUser } from "./access";
import { DEMO_ACCOUNTS } from "./demo-accounts";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const FILE = join(process.cwd(), ".data", "users.json");

type StoredUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  patientIds: string[];
  verified: boolean;
  salt: string;
  hash: string;
  createdAt: string;
};

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return { salt: salt.toString("hex"), hash: (await scrypt(password, salt, 64)).toString("hex") };
}

function read(): StoredUser[] | null {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as { users?: StoredUser[] };
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return null;
  }
}

function write(users: StoredUser[]) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ users }, null, 2));
}

let seeding: Promise<StoredUser[]> | null = null;

async function load(): Promise<StoredUser[]> {
  const existing = read();
  if (existing) return existing;
  seeding ??= (async () => {
    const users: StoredUser[] = [];
    for (const a of DEMO_ACCOUNTS) {
      users.push({ id: randomUUID(), username: a.username, displayName: a.displayName, role: a.role, patientIds: a.patientIds, verified: a.verified, ...(await hashPassword(a.password)), createdAt: new Date().toISOString() });
    }
    write(users);
    return users;
  })();
  return seeding;
}

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
const toSession = (u: StoredUser): SessionUser => ({ uid: u.id, name: u.displayName, role: u.role, patientIds: u.patientIds, verified: u.verified });

// A fixed dummy hash so unknown usernames take as long as wrong passwords.
let dummy: Promise<{ salt: string; hash: string }> | null = null;

export async function verifyLogin(username: string, password: string): Promise<SessionUser | null> {
  const users = await load();
  const user = users.find((u) => u.username === normalizeUsername(username));
  dummy ??= hashPassword(randomUUID());
  const ref = user ?? (await dummy);
  const actual = await scrypt(password, Buffer.from(ref.salt, "hex"), 64);
  const ok = timingSafeEqual(actual, Buffer.from(ref.hash, "hex"));
  return user && ok ? toSession(user) : null;
}

export async function usernameTaken(username: string) {
  return (await load()).some((u) => u.username === normalizeUsername(username));
}

export async function patientHasAccount(patientId: string) {
  return (await load()).some((u) => u.role === "patient" && u.patientIds.includes(patientId));
}

export async function createUser(input: { username: string; password: string; displayName: string; role: Role; patientIds: string[]; verified: boolean }): Promise<SessionUser> {
  const users = await load();
  const user: StoredUser = {
    id: randomUUID(),
    username: normalizeUsername(input.username),
    displayName: input.displayName.trim(),
    role: input.role,
    patientIds: input.patientIds,
    verified: input.verified,
    ...(await hashPassword(input.password)),
    createdAt: new Date().toISOString(),
  };
  write([...users, user]);
  return toSession(user);
}
