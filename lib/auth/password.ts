import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

type PasswordRecord = {
  salt: string;
  hash: string;
};

function parsePasswordRecord(value: string): PasswordRecord | null {
  const parts = value.split("$");
  if (parts.length !== 3) return null;
  if (parts[0] !== "scrypt") return null;
  const salt = parts[1]?.trim();
  const hash = parts[2]?.trim();
  if (!salt || !hash) return null;
  return { salt, hash };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedPassword: string,
): Promise<boolean> {
  const parsed = parsePasswordRecord(storedPassword);
  if (!parsed) return false;
  const derived = (await scryptAsync(password, parsed.salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(parsed.hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
