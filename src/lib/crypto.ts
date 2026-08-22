/** Low-level AES-GCM + PBKDF2 helpers backing the encrypted vault. No app-specific knowledge here. */

export const PBKDF2_ITERATIONS = 210_000; // OWASP-recommended floor for PBKDF2-HMAC-SHA256 as of 2023
export const SALT_BYTES = 16;
const IV_BYTES = 12; // recommended nonce size for AES-GCM

export function bytesToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derives an AES-GCM key from a PIN. The raw PIN is never used as a key directly. */
export async function deriveKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
}

export async function encryptJSON(key: CryptoKey, data: unknown): Promise<EncryptedPayload> {
  const iv = randomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, encoded);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(cipherBuf) };
}

/** Throws if `key` is wrong or the payload has been tampered with — AES-GCM's auth tag makes this the PIN check. */
export async function decryptJSON<T>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  const iv = base64ToBytes(payload.iv);
  const cipherBuf = base64ToBytes(payload.ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipherBuf as unknown as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}
