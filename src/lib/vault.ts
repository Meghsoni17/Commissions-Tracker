import type { AppData } from '../types';
import { normalizeAppData } from './storage';
import { PBKDF2_ITERATIONS, SALT_BYTES, base64ToBytes, bytesToBase64, decryptJSON, deriveKey, encryptJSON, randomBytes } from './crypto';

const VAULT_KEY = 'commtrack-vault-v1';

interface VaultBlob {
  salt: string; // base64
  iterations: number;
  iv: string; // base64
  ciphertext: string; // base64
}

export interface VaultSession {
  key: CryptoKey;
  data: AppData;
}

export function hasVault(): boolean {
  return localStorage.getItem(VAULT_KEY) !== null;
}

export function clearVault(): void {
  localStorage.removeItem(VAULT_KEY);
}

function readBlob(): VaultBlob | null {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultBlob;
  } catch {
    return null;
  }
}

/** Creates a brand-new vault encrypted with a key derived from `pin`, replacing any existing one. */
export async function createVault(pin: string, data: AppData): Promise<CryptoKey> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(pin, salt, PBKDF2_ITERATIONS);
  const { iv, ciphertext } = await encryptJSON(key, data);
  const blob: VaultBlob = { salt: bytesToBase64(salt), iterations: PBKDF2_ITERATIONS, iv, ciphertext };
  localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
  return key;
}

/**
 * Derives a key from `pin` using the vault's stored salt/iterations and attempts to decrypt.
 * Returns null if there's no vault, or if the PIN is wrong (AES-GCM auth tag fails) — a wrong
 * PIN simply can't produce a key that decrypts the data, so this IS the PIN check.
 */
export async function openVault(pin: string): Promise<VaultSession | null> {
  const blob = readBlob();
  if (!blob) return null;
  try {
    const salt = base64ToBytes(blob.salt);
    const key = await deriveKey(pin, salt, blob.iterations);
    const decrypted = await decryptJSON<unknown>(key, { iv: blob.iv, ciphertext: blob.ciphertext });
    const data = normalizeAppData(decrypted);
    if (!data) return null;
    return { key, data };
  } catch {
    return null;
  }
}

/** Re-encrypts `data` with the already-derived `key`, keeping the vault's existing salt/iterations. */
export async function saveVault(key: CryptoKey, data: AppData): Promise<void> {
  const existing = readBlob();
  if (!existing) return;
  const { iv, ciphertext } = await encryptJSON(key, data);
  const blob: VaultBlob = { ...existing, iv, ciphertext };
  localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
}
