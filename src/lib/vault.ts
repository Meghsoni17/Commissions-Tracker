/**
 * Read-only access to the PIN-encrypted vault that older versions of CommTrack kept in this browser's
 * localStorage. Data now lives in Supabase; this is only used by "Import My Local Data".
 */
import type { AppData } from '../types';
import { normalizeAppData } from './storage';
import { base64ToBytes, decryptJSON, deriveKey } from './crypto';

const VAULT_KEY = 'commtrack-vault-v1';

interface VaultBlob {
  salt: string; // base64
  iterations: number;
  iv: string; // base64
  ciphertext: string; // base64
}

function readBlob(): VaultBlob | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? (JSON.parse(raw) as VaultBlob) : null;
  } catch {
    return null;
  }
}

export function hasVault(): boolean {
  return readBlob() !== null;
}

/**
 * Decrypts the local vault with the PIN this browser used. Returns null if the PIN is wrong (the AES-GCM
 * auth tag fails) or there's nothing readable.
 */
export async function openVault(pin: string): Promise<AppData | null> {
  const blob = readBlob();
  if (!blob) return null;
  try {
    const key = await deriveKey(pin, base64ToBytes(blob.salt), blob.iterations);
    const decrypted = await decryptJSON<unknown>(key, { iv: blob.iv, ciphertext: blob.ciphertext });
    return normalizeAppData(decrypted);
  } catch {
    return null;
  }
}
