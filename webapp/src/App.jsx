import { useState, useEffect, useCallback } from 'react';
import ProfileEditor from './components/ProfileEditor';
import MatcherTable from './components/MatcherTable';
import { loadProfile, saveProfile, exportProfile, importProfile } from './store/profile';

export default function App() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('profile');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const handleSave = useCallback((p) => {
    saveProfile(p);
    setProfile(p);
    setMsg('Saved ' + new Date().toLocaleTimeString());
    setTimeout(() => setMsg(''), 2000);
  }, []);

  const handleExport = useCallback(() => {
    exportProfile(profile);
    setMsg('Exported to JSON');
    setTimeout(() => setMsg(''), 2000);
  }, [profile]);

  const handleImport = useCallback(async (file) => {
    const p = await importProfile(file);
    if (p) {
      handleSave(p);
      setMsg('Imported profile');
    } else {
      setMsg('Import failed');
    }
    setTimeout(() => setMsg(''), 2000);
  }, [handleSave]);

  if (!profile) return <div className="loading">Loading profile...</div>;

  return (
    <div className="app">
      <header>
        <h1>Profile Filler</h1>
        <p className="subtitle">Store your data. Auto-fill Google Forms.</p>
        {msg && <div className="flash">{msg}</div>}
      </header>
      <nav>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button>
        <button className={tab === 'matchers' ? 'active' : ''} onClick={() => setTab('matchers')}>Matching</button>
        <button className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}>Import/Export</button>
      </nav>
      <main>
        {tab === 'profile' && <ProfileEditor profile={profile} onSave={handleSave} />}
        {tab === 'matchers' && <MatcherTable profile={profile} onSave={handleSave} />}
        {tab === 'export' && (
          <div className="card">
            <h2>Import / Export</h2>
            <p>Download your profile as JSON or restore from a backup.</p>
            <div className="actions">
              <button className="primary" onClick={handleExport}>Export JSON</button>
              <label className="btn">
                Import JSON
                <input type="file" accept=".json" style={{display:'none'}} onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])} />
              </label>
            </div>
          </div>
        )}
      </main>
      <footer>
        <small>Profile Filler v1.0 • Chrome Extension + Webapp</small>
      </footer>
    </div>
  );
}
