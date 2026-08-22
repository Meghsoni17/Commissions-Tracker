import { useState } from 'react';
import { PinInput } from './PinInput';
import { clearPin, hasPinSet, setPin, verifyPin } from '../lib/pin';

type Mode = 'unlock' | 'setup-enter' | 'setup-confirm';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<Mode>(() => (hasPinSet() ? 'unlock' : 'setup-enter'));
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
    await setPin(pin);
    setBusy(false);
    onUnlock();
  }

  async function handleUnlockAttempt(pin: string) {
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) {
      setError('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Try again.');
      retry();
    }
  }

  function handleForgot() {
    clearPin();
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
              Enter your PIN to continue
            </p>
            <PinInput key={attempt} onComplete={handleUnlockAttempt} disabled={busy} />
            <div className="h-5 mt-4">
              {error && (
                <p className="text-sm" style={{ color: 'var(--critical)' }}>
                  {error}
                </p>
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
            <div className="h-5 mt-4" />
          </>
        )}

        {confirmingForgot && (
          <div
            className="mt-4 rounded-lg border p-4 text-left text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
              This clears your saved PIN so you can set a new one. Your commission data is stored
              separately and will not be affected.
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
                Reset PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
