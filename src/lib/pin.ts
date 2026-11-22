/**
 * PIN lock. The PIN is stored in the user's Supabase settings row as a salted PBKDF2-SHA256 hash, so the
 * same PIN unlocks the app on every device. It is an extra lock on top of the Supabase sign-in.
 */
import type { PinRecord } from './cloud';
import { PBKDF2_ITERATIONS, SALT_BYTES, base64ToBytes, bytesToBase64, randomBytes } from './crypto';

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    256,
  );
  return bytesToBase64(bits);
}

export async function createPinRecord(pin: string): Promise<PinRecord> {
  const salt = randomBytes(SALT_BYTES);
  return { hash: await pbkdf2(pin, salt, PBKDF2_ITERATIONS), salt: bytesToBase64(salt), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  try {
    const hash = await pbkdf2(pin, base64ToBytes(record.salt), record.iterations || PBKDF2_ITERATIONS);
    return hash === record.hash;
  } catch {
    return false;
  }
}

/** Set by "Forgot PIN?" before signing out; lets the next sign-in by the same account choose a new PIN. */
const PIN_RESET_KEY = 'commtrack-pin-reset-requested';

export function requestPinReset(userId: string): void {
  try {
    localStorage.setItem(PIN_RESET_KEY, userId);
  } catch {
    /* storage blocked: the user simply won't be offered a reset */
  }
}

export function isPinResetRequested(userId: string): boolean {
  try {
    return localStorage.getItem(PIN_RESET_KEY) === userId;
  } catch {
    return false;
  }
}

export function clearPinResetRequest(): void {
  try {
    localStorage.removeItem(PIN_RESET_KEY);
  } catch {
    /* ignore */
  }
}
