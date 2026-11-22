import type { CSSProperties, ReactNode } from 'react';

export const inputStyle: CSSProperties = {
  borderColor: 'var(--border)',
  background: 'var(--surface-3)',
  color: 'var(--text-primary)',
};

/** The centered card used by the sign-in, loading and PIN screens. */
export function ScreenCard({ children }: { children: ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-5 h-5 rounded-full border-2 animate-spin"
      style={{ borderColor: 'var(--border)', borderTopColor: 'var(--series-1)' }}
    />
  );
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <ScreenCard>
      <div className="flex flex-col items-center gap-3 mt-6" role="status" aria-live="polite">
        <Spinner />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      </div>
    </ScreenCard>
  );
}
