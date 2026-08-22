import { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout, type Tab } from './components/Layout';
import { LockScreen } from './components/LockScreen';
import { Dashboard } from './pages/Dashboard';
import { EntriesPage } from './pages/EntriesPage';
import { RolesPage } from './pages/RolesPage';
import { TaxPage } from './pages/TaxPage';

function SampleDataBanner() {
  const { isSampleData, clearSampleData } = useData();
  if (!isSampleData) return null;
  return (
    <div
      className="rounded-lg border px-4 py-2.5 mb-6 flex items-center justify-between gap-3 flex-wrap text-sm"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-secondary)' }}
    >
      <span>You're viewing sample data so you can see how the dashboard works.</span>
      <button
        onClick={clearSampleData}
        className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer shrink-0"
        style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      >
        Clear sample data
      </button>
    </div>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('dashboard');
  return (
    <Layout active={tab} onChange={setTab}>
      <SampleDataBanner />
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'entries' && <EntriesPage />}
      {tab === 'roles' && <RolesPage />}
      {tab === 'tax' && <TaxPage />}
    </Layout>
  );
}

function App() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <ThemeProvider>
      {unlocked ? (
        <DataProvider>
          <AppShell />
        </DataProvider>
      ) : (
        <LockScreen onUnlock={() => setUnlocked(true)} />
      )}
    </ThemeProvider>
  );
}

export default App;
