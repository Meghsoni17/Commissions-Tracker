/** Finds data that older, local-only versions of CommTrack saved in this browser, for a one-time import. */
import { hasVault } from './vault';
import { hasLegacyPlaintextData } from './storage';

export type LocalSource = 'vault' | 'plaintext';

/** Which kind of local data this browser has, if any. The encrypted vault needs its old PIN to read. */
export function localDataSource(): LocalSource | null {
  try {
    if (hasVault()) return 'vault';
    if (hasLegacyPlaintextData()) return 'plaintext';
  } catch {
    /* storage blocked */
  }
  return null;
}

const doneKey = (userId: string) => `commtrack-local-import-done:${userId}`;

export function isLocalImportDone(userId: string): boolean {
  try {
    return localStorage.getItem(doneKey(userId)) !== null;
  } catch {
    return true; // can't read storage, so there's nothing to import either
  }
}

export function markLocalImportDone(userId: string): void {
  try {
    localStorage.setItem(doneKey(userId), new Date().toISOString());
  } catch {
    /* ignore */
  }
}
