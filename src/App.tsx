import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { DataProvider, useData } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout, type Tab } from './components/Layout';
import { LockScreen } from './components/LockScreen';
import { AuthScreen } from './components/AuthScreen';
import { LoadingScreen, ScreenCard } from './components/ScreenCard';
import { ImportLocalBanner, SaveErrorBanner, SaveIndicator } from './components/CloudBanners';
import { Dashboard } from './pages/Dashboard';
import { EntriesPage } from './pages/EntriesPage';
import { DealsPage } from './pages/DealsPage';
import { RolesPage } from './pages/RolesPage';
import { TaxPage } from './pages/TaxPage';
import { SuperPage } from './pages/SuperPage';
import { useAutoLock } from './hooks/useAutoLock';
import { fetchCloudData, type CloudSnapshot, type PinRecord } from './lib/cloud';
import { errorMessage, isSupabaseConfigured, requireSupabase } from './lib/supabase';

const AUTO_LOCK_MS = 5 * 60 * 1000;

function signOut() {
  void requireSupabase().auth.signOut({ scope: 'local' });
}

function AppShell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  return (
    <Layout
      active={tab}
      onChange={setTab}
      headerActions={
        <>
          <SaveIndicator />
          <button
            onClick={signOut}
            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Sign Out
          </button>
        </>
      }
    >
      <SaveErrorBanner />
      <ImportLocalBanner userId={userId} />
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'entries' && <EntriesPage />}
      {tab === 'deals' && <DealsPage />}
      {tab === 'roles' && <RolesPage />}
      {tab === 'tax' && <TaxPage />}
      {tab === 'super' && <SuperPage />}
    </Layout>
  );
}

/** Behind the PIN lock. Stays mounted while locked so unsaved changes keep retrying in the background. */
function UnlockedOrLocked({ user, pin, onPinSaved }: { user: User; pin: PinRecord | null; onPinSaved: (p: PinRecord) => void }) {
  const { refresh } = useData();
  const [unlocked, setUnlocked] = useState(false);
  const wasLockedRef = useRef(false);

  useAutoLock(
    unlocked,
    () => {
      wasLockedRef.current = true;
      setUnlocked(false);
    },
    AUTO_LOCK_MS,
  );

  function handleUnlock() {
    setUnlocked(true);
    // After an auto-lock, pick up anything changed on other devices meanwhile.
    if (wasLockedRef.current) {
      wasLockedRef.current = false;
      refresh().catch((err) => console.error('Refresh after unlock failed:', err));
    }
  }

  if (!unlocked) {
    return <LockScreen userId={user.id} email={user.email} pin={pin} onUnlock={handleUnlock} onPinSaved={onPinSaved} />;
  }
  return <AppShell userId={user.id} />;
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; snapshot: CloudSnapshot };

function SignedInApp({ user }: { user: User }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [pin, setPin] = useState<PinRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      const snapshot = await fetchCloudData();
      setPin(snapshot.pin);
      setLoad({ status: 'ready', snapshot });
    } catch (err) {
      console.error('Failed to load from Supabase:', err);
      setLoad({ status: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (load.status === 'loading') return <LoadingScreen message="Loading your data…" />;

  if (load.status === 'error') {
    const looksUnset = /does not exist|permission denied|schema cache|42P01|42501/i.test(load.message);
    return (
      <ScreenCard>
        <p className="text-sm mt-4 mb-2" style={{ color: 'var(--critical)' }}>
          Couldn't load your data.
        </p>
        <p className="text-xs mb-4 break-words" style={{ color: 'var(--text-secondary)' }}>
          {load.message}
          {looksUnset && ' Has supabase/schema.sql been run in the Supabase SQL editor?'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Sign Out
          </button>
          <button
            onClick={() => void loadData()}
            className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer text-white"
            style={{ background: 'var(--series-1)' }}
          >
            Try Again
          </button>
        </div>
      </ScreenCard>
    );
  }

  return (
    <DataProvider userId={user.id} initialData={load.snapshot.data}>
      <UnlockedOrLocked user={user} pin={pin} onPinSaved={setPin} />
    </DataProvider>
  );
}

function AuthGate() {
  // undefined = still checking for a saved sign-in.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const auth = requireSupabase().auth;
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingScreen message="Checking sign-in…" />;
  if (!session) return <AuthScreen />;
  // Keyed by user so switching accounts starts fresh; token refreshes don't remount.
  return <SignedInApp key={session.user.id} user={session.user} />;
}

function NotConfigured() {
  return (
    <ScreenCard>
      <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
        Cloud sync isn't configured. Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in{' '}
        <code>.env</code> (locally) or in Vercel's environment variables, then rebuild.
      </p>
    </ScreenCard>
  );
}

function App() {
  return <ThemeProvider>{isSupabaseConfigured ? <AuthGate /> : <NotConfigured />}</ThemeProvider>;
}

export default App;
