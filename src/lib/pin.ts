const PIN_KEY = 'commtrack-pin-v1';

interface StoredPin {
  salt: string;
  hash: string;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  return bufToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bufToHex(digest);
}

export function hasPinSet(): boolean {
  return localStorage.getItem(PIN_KEY) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const stored: StoredPin = { salt, hash };
  localStorage.setItem(PIN_KEY, JSON.stringify(stored));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(PIN_KEY);
  if (!raw) return false;
  try {
    const stored = JSON.parse(raw) as StoredPin;
    const hash = await hashPin(pin, stored.salt);
    return hash === stored.hash;
  } catch {
    return false;
  }
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY);
}
