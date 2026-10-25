import bcrypt from "bcryptjs";
import * as Crypto from "expo-crypto";

const SALT_ROUNDS = 10;

// bcryptjs fallback por si el polyfill de crypto no está disponible
bcrypt.setRandomFallback((len: number) => {
  const bytes = new Uint8Array(len);
  Crypto.getRandomValues(bytes);
  return Array.from(bytes);
});

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || !password) {
    throw new Error("Password must be a non-empty string");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  if (!stored || typeof stored !== "string") return false;
  if (stored.startsWith("$expo$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA512,
      parts[2] + password,
      { encoding: Crypto.CryptoEncoding.HEX },
    );
    return hash === parts[3];
  }
  if (!/^\$2[aby]\$\d+/.test(stored)) return false;
  return bcrypt.compare(password, stored);
}

export function isExpoHash(str: string): boolean {
  return typeof str === "string" && str.startsWith("$expo$");
}

export function isHashed(str: string): boolean {
  return isExpoHash(str) || (typeof str === "string" && /^\$2[aby]\$\d+/.test(str));
}
