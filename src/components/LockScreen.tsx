import { useState } from 'react';
import { PinInput } from './PinInput';
import { clearPin, hasPinSet, verifyPin } from '../lib/pin';
import { clearLegacyPlaintextData, loadLegacyPlaintextData } from '../lib/storage';
import { buildSeedData } from '../lib/seedData';
import { clearVault, createVault, hasVault, openVault, type VaultSession } from '../lib/vault';
import type { AppData } from '../types';

type Mode = 'unlock' | 'migrate' | 'setup-enter' | 'setup-confirm';

function determineInitialMode(): Mode {
  if (hasVault()) return 'unlock';
  if (hasPinSet()) return 'migrate';
  return 'setup-enter';
}

/** Seed data for a brand-new vault: prefer any pre-encryption data found on disk, else sample data. */
function seedDataForNewVault(): AppData {
  const legacy = loadLegacyPlaintextData();
  if (legacy) return legacy;
  return { ...buildSeedData(), isSample: true };
}

export function LockScreen({ onUnlock }: { onUnlock: (session: VaultSession) => void }) {
  const [mode, setMode] = useState<Mode>(determineInitialMode);
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmingForgot, setConfirmingForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  function retry() {
    setAttempt((a) => a + 1);
  }

  function handleSetupFirst(pin: string) {
    setFirstPin(pin);
    setError('');
    setMode('setup-confirm');
    retry();
  }

  async function handleSetupConfirm(pin: string) {
    if (pin !== firstPin) {
      setError("PINs didn't match. Let's start over.");
      setFirstPin('');
      setMode('setup-enter');
      retry();
      return;
    }
    setBusy(true);
    const data = seedDataForNewVault();
    const key = await createVault(pin, data);
    clearLegacyPlaintextData();
    setBusy(false);
    onUnlock({ key, data });
  }

  async function handleMigrateAttempt(pin: string) {
    setBusy(true);
    const ok = await verifyPin(pin);
    if (!ok) {
      setBusy(false);
      setError('Incorrect PIN. Try again.');
      retry();
      return;
    }
    const data = seedDataForNewVault();
    const key = await createVault(pin, data);
    clearLegacyPlaintextData();
    clearPin();
    setBusy(false);
    onUnlock({ key, data });
  }

  async function handleUnlockAttempt(pin: string) {
    setBusy(true);
    const session = await openVault(pin);
    setBusy(false);
    if (session) {
      setError('');
      onUnlock(session);
    } else {
      setError('Incorrect PIN. Try again.');
      retry();
    }
  }

  function handleForgot() {
    clearVault();
    clearPin();
    clearLegacyPlaintextData();
    setError('');
    setFirstPin('');
    setConfirmingForgot(false);
    setMode('setup-enter');
    retry();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <h1 className="text-lg font-semibold mb-1">CommTrack</h1>

        {mode === 'unlock' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Enter your PIN to decrypt and continue
            </p>
            <PinInput key={attempt} onComplete={handleUnlockAttempt} disabled={busy} />
            <div className="h-5 mt-4">
              {busy ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Decrypting…
                </p>
              ) : (
                error && (
                  <p className="text-sm" style={{ color: 'var(--critical)' }}>
                    {error}
                  </p>
                )
              )}
            </div>
            {!confirmingForgot && (
              <button
                onClick={() => setConfirmingForgot(true)}
                className="mt-2 text-xs underline cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                Forgot PIN?
              </button>
            )}
          </>
        )}

        {mode === 'migrate' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              CommTrack now encrypts your data. Enter your current PIN to switch to encrypted storage.
            </p>
            <PinInput key={attempt} onComplete={handleMigrateAttempt} disabled={busy} />
            <div className="h-5 mt-4">
              {busy ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Encrypting…
                </p>
              ) : (
                error && (
                  <p className="text-sm" style={{ color: 'var(--critical)' }}>
                    {error}
                  </p>
                )
              )}
            </div>
            {!confirmingForgot && (
              <button
                onClick={() => setConfirmingForgot(true)}
                className="mt-2 text-xs underline cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                Forgot PIN?
              </button>
            )}
          </>
        )}

        {mode === 'setup-enter' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Set a 6-digit PIN to lock this app
            </p>
            <PinInput key={attempt} onComplete={handleSetupFirst} disabled={busy} />
            <div className="h-5 mt-4">
              {error && (
                <p className="text-sm" style={{ color: 'var(--critical)' }}>
                  {error}
                </p>
              )}
            </div>
          </>
        )}

        {mode === 'setup-confirm' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Confirm your PIN
            </p>
            <PinInput key={attempt} onComplete={handleSetupConfirm} disabled={busy} />
            <div className="h-5 mt-4">
              {busy && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Setting up encryption…
                </p>
              )}
            </div>
          </>
        )}

        {confirmingForgot && (
          <div
            className="mt-4 rounded-lg border p-4 text-left text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--critical)' }}>This permanently deletes your data.</strong> Your data is
              encrypted with a key derived from your PIN, so without the old PIN there is no way to decrypt or
              recover it. Resetting will erase the encrypted data and let you set a new PIN with a blank slate.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmingForgot(false)}
                className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleForgot}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
                style={{ background: 'var(--critical)', color: '#fff' }}
              >
                Erase Data & Reset PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
