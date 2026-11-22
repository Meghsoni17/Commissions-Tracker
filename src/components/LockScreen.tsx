import { useState } from 'react';
import { PinInput } from './PinInput';
import { ScreenCard } from './ScreenCard';
import { clearPinResetRequest, createPinRecord, isPinResetRequested, requestPinReset, verifyPin } from '../lib/pin';
import { savePinRecord, type PinRecord } from '../lib/cloud';
import { errorMessage, requireSupabase } from '../lib/supabase';

type Mode = 'unlock' | 'setup-enter' | 'setup-confirm';

/**
 * PIN lock shown after Supabase sign-in and after auto-lock. The PIN hash lives in the user's cloud
 * settings, so it's the same on every device. A forgotten PIN is reset by signing in again with email.
 */
export function LockScreen({
  userId,
  email,
  pin,
  onUnlock,
  onPinSaved,
}: {
  userId: string;
  email: string | undefined;
  pin: PinRecord | null;
  onUnlock: () => void;
  onPinSaved: (pin: PinRecord) => void;
}) {
  const resetting = pin !== null && isPinResetRequested(userId);
  const [mode, setMode] = useState<Mode>(() => (pin && !resetting ? 'unlock' : 'setup-enter'));
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmingForgot, setConfirmingForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  function retry() {
    setAttempt((a) => a + 1);
  }

  function handleSetupFirst(value: string) {
    setFirstPin(value);
    setError('');
    setMode('setup-confirm');
    retry();
  }

  async function handleSetupConfirm(value: string) {
    if (value !== firstPin) {
      setError("PINs didn't match. Let's start over.");
      setFirstPin('');
      setMode('setup-enter');
      retry();
      return;
    }
    setBusy(true);
    try {
      const record = await createPinRecord(value);
      await savePinRecord(userId, record);
      clearPinResetRequest();
      onPinSaved(record);
      onUnlock();
    } catch (err) {
      setError(`Couldn't save your PIN: ${errorMessage(err)}`);
      setFirstPin('');
      setMode('setup-enter');
      retry();
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlockAttempt(value: string) {
    if (!pin) return;
    setBusy(true);
    const ok = await verifyPin(value, pin);
    setBusy(false);
    if (ok) {
      setError('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Try again.');
      retry();
    }
  }

  async function signOut(resetPin: boolean) {
    setBusy(true);
    if (resetPin) requestPinReset(userId);
    const { error: signOutError } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (signOutError) {
      // Never leave a reset flag behind without an actual sign-out, or the PIN could be changed without re-auth.
      clearPinResetRequest();
      setBusy(false);
      setError(`Couldn't sign out: ${errorMessage(signOutError)}`);
    }
  }

  const status = (busyText: string) => (
    <div className="h-5 mt-4">
      {busy ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {busyText}
        </p>
      ) : (
        error && (
          <p className="text-sm" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )
      )}
    </div>
  );

  return (
    <ScreenCard>
      {mode === 'unlock' && (
        <>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Enter your PIN to continue
          </p>
          <PinInput key={attempt} onComplete={handleUnlockAttempt} disabled={busy} />
          {status('Checking…')}
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
            {resetting ? 'Choose a new 6-digit PIN' : 'Set a 6-digit PIN to lock this app on all your devices'}
          </p>
          <PinInput key={attempt} onComplete={handleSetupFirst} disabled={busy} />
          {status('Saving…')}
        </>
      )}

      {mode === 'setup-confirm' && (
        <>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Confirm your PIN
          </p>
          <PinInput key={attempt} onComplete={handleSetupConfirm} disabled={busy} />
          {status('Saving your PIN…')}
        </>
      )}

      {confirmingForgot && (
        <div
          className="mt-4 rounded-lg border p-4 text-left text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
            To reset your PIN, sign in again with your email. Your data is stored in your account and{' '}
            <strong style={{ color: 'var(--text-primary)' }}>won't be deleted</strong>. After signing back in on this
            device you'll choose a new PIN.
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
              onClick={() => void signOut(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer text-white"
              style={{ background: 'var(--series-1)' }}
            >
              Sign Out & Reset PIN
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
        {email ? <>Signed in as {email} · </> : null}
        <button onClick={() => void signOut(false)} disabled={busy} className="underline cursor-pointer">
          Sign out
        </button>
      </p>
    </ScreenCard>
  );
}
