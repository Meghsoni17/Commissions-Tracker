import { useState } from 'react';
import { useData } from '../context/DataContext';
import { PinInput } from './PinInput';
import { Spinner } from './ScreenCard';
import { isLocalImportDone, localDataSource, markLocalImportDone } from '../lib/localImport';
import { loadLegacyPlaintextData } from '../lib/storage';
import { openVault } from '../lib/vault';
import { errorMessage } from '../lib/supabase';
import type { ImportCounts } from '../lib/cloud';
import type { AppData } from '../types';

const bannerClass = 'rounded-lg border px-4 py-3 mb-6 text-sm';

/** Small "Saving… / Saved / Save failed" label for the header. */
export function SaveIndicator() {
  const { saveStatus } = useData();
  const label = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved';
  return (
    <span
      className="text-xs tabular-nums"
      role="status"
      aria-live="polite"
      style={{ color: saveStatus === 'error' ? 'var(--critical)' : 'var(--text-muted)' }}
    >
      {label}
    </span>
  );
}

/** Shown when the last save to Supabase failed. Edits stay on screen and are retried. */
export function SaveErrorBanner() {
  const { saveStatus, saveError, retrySave } = useData();
  if (saveStatus !== 'error') return null;
  return (
    <div
      role="alert"
      className={`${bannerClass} flex items-center justify-between gap-3 flex-wrap`}
      style={{ borderColor: 'var(--critical)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
    >
      <span>
        <strong style={{ color: 'var(--critical)' }}>Your latest changes weren't saved.</strong>{' '}
        <span style={{ color: 'var(--text-secondary)' }}>
          {saveError} They're still on screen; retry before closing this tab.
        </span>
      </span>
      <button
        onClick={retrySave}
        className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer shrink-0 text-white"
        style={{ background: 'var(--critical)' }}
      >
        Retry Save
      </button>
    </div>
  );
}

function describeCounts(c: ImportCounts): string {
  const parts = [
    [c.roles, 'role'],
    [c.entries, 'entry', 'entries'],
    [c.deals, 'deal'],
    [c.monthlyGoals, 'monthly goal'],
    [c.deductions, 'deduction'],
    [c.superContributions, 'super contribution'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : (many ?? `${one}s`)}`);
  if (parts.length === 0) return 'Everything in this browser was already in your account, so nothing new was added.';
  return `Imported ${parts.join(', ')}. Records already in your account were skipped.`;
}

type Stage = 'offer' | 'pin' | 'busy' | 'done' | 'hidden';

/**
 * One-time "Import My Local Data": uploads what older versions saved in this browser's localStorage.
 * Records are matched by id, so running it again never creates duplicates. Local data is left in place.
 */
export function ImportLocalBanner({ userId }: { userId: string }) {
  const { importLocalData } = useData();
  const [source] = useState(() => (isLocalImportDone(userId) ? null : localDataSource()));
  const [stage, setStage] = useState<Stage>('offer');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [attempt, setAttempt] = useState(0);

  if (!source || stage === 'hidden') return null;

  async function upload(local: AppData | null) {
    if (!local) {
      setError("Couldn't read the data saved in this browser.");
      setStage('offer');
      return;
    }
    if (local.isSample) {
      markLocalImportDone(userId);
      setResult('This browser only had sample data, so there was nothing real to import.');
      setStage('done');
      return;
    }
    setStage('busy');
    try {
      const counts = await importLocalData(local);
      markLocalImportDone(userId);
      setResult(describeCounts(counts));
      setStage('done');
    } catch (err) {
      setError(`Import failed: ${errorMessage(err)}`);
      setStage('offer');
    }
  }

  function start() {
    setError('');
    if (source === 'plaintext') void upload(loadLegacyPlaintextData());
    else setStage('pin');
  }

  async function handlePin(pin: string) {
    setStage('busy');
    const local = await openVault(pin);
    if (!local) {
      setError("That PIN didn't unlock this browser's saved data. Use the PIN you used here before.");
      setAttempt((a) => a + 1);
      setStage('pin');
      return;
    }
    setError('');
    await upload(local);
  }

  function dismiss() {
    markLocalImportDone(userId);
    setStage('hidden');
  }

  const secondaryButton = 'rounded-md px-3 py-1 text-xs font-medium cursor-pointer shrink-0';

  return (
    <div className={bannerClass} style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-secondary)' }}>
      {stage === 'offer' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span>This browser has CommTrack data saved from before cloud sync. Upload it to your account?</span>
          <div className="flex gap-2">
            <button onClick={dismiss} className={secondaryButton} style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Not Now
            </button>
            <button onClick={start} className={`${secondaryButton} text-white`} style={{ background: 'var(--series-1)' }}>
              Import My Local Data
            </button>
          </div>
        </div>
      )}

      {stage === 'pin' && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span>Enter the PIN you used in this browser before, to unlock its saved data.</span>
          <PinInput key={attempt} onComplete={(pin) => void handlePin(pin)} />
          <button onClick={() => setStage('offer')} className="text-xs underline cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      )}

      {stage === 'busy' && (
        <div className="flex items-center gap-3" role="status">
          <Spinner />
          <span>Importing your local data…</span>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span style={{ color: 'var(--success)' }}>{result}</span>
          <button
            onClick={() => setStage('hidden')}
            className={secondaryButton}
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && stage !== 'busy' && (
        <p className="mt-2 text-sm" style={{ color: 'var(--critical)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
