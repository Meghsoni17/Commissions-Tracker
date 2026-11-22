import { useState, type FormEvent } from 'react';
import { ScreenCard, inputStyle } from './ScreenCard';
import { errorMessage, requireSupabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'magic';

const COPY: Record<Mode, { intro: string; submit: string; busy: string }> = {
  signin: { intro: 'Sign in to load your data on this device', submit: 'Sign In', busy: 'Signing in…' },
  signup: { intro: 'Create your account', submit: 'Create Account', busy: 'Creating account…' },
  magic: { intro: "We'll email you a link that signs you in", submit: 'Email Me A Sign-In Link', busy: 'Sending…' },
};

/** Supabase email sign-in: email + password, or a magic link. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const auth = requireSupabase().auth;
    const redirectTo = window.location.origin;
    try {
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (!data.session) setNotice('Check your email to confirm your account, then come back and sign in.');
      } else {
        const { error } = await auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setNotice('Check your email for a sign-in link. Open it in this browser.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const copy = COPY[mode];

  return (
    <ScreenCard>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {copy.intro}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </label>
        {mode !== 'magic' && (
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Password
            <input
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-60 disabled:cursor-default"
          style={{ background: 'var(--series-1)' }}
        >
          {busy ? copy.busy : copy.submit}
        </button>
      </form>

      <div className="min-h-5 mt-4" aria-live="polite">
        {error && (
          <p className="text-sm" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm" style={{ color: 'var(--success)' }}>
            {notice}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        {mode !== 'magic' && (
          <button onClick={() => switchMode('magic')} className="underline cursor-pointer">
            Email me a sign-in link instead
          </button>
        )}
        {mode !== 'signin' && (
          <button onClick={() => switchMode('signin')} className="underline cursor-pointer">
            Sign in with a password
          </button>
        )}
        {mode === 'signin' && (
          <button onClick={() => switchMode('signup')} className="underline cursor-pointer">
            First time here? Create an account
          </button>
        )}
      </div>
    </ScreenCard>
  );
}
