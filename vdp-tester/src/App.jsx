import './App.css';
import React, { useState } from 'react';
import AuthForm from './components/Auth/AuthForm';
import RequestBuilder from './components/RequestBuilder/RequestBuilder';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [cert, setCert] = useState(null);
  const [key, setKey] = useState(null);
  const [response, setResponse] = useState(null);

  const handleFile = (setter) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setter(evt.target.result);
    reader.readAsText(file);
  };

  const handleSend = async () => {
    if (!userId || !password || !cert || !key) {
      alert('Please provide all credentials and certs.');
      return;
    }
    const res = await window.visaApi.helloWorld({ userId, password, cert, key });
    setResponse(res);
  };

  return (
    <div className="vdt-root">
      <header className="vdt-header">
        {/* Top Tabs: Authentication, Settings, History, Collections */}
        <div className="vdt-tabs">Tabs Placeholder</div>
        <button style={{ marginLeft: 'auto' }} onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>
      <div className="vdt-main-layout">
        <aside className="vdt-left-panel">LeftPanel Placeholder</aside>
        <main className="vdt-center-panel">
          <RequestBuilder />
          <div style={{ padding: 32 }}>
            <h2>Visa Hello World Test</h2>
            <div>
              <label>User ID: <input value={userId} onChange={e => setUserId(e.target.value)} /></label>
            </div>
            <div>
              <label>Password: <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            </div>
            <div>
              <label>Certificate (.pem): <input type="file" accept=".pem" onChange={handleFile(setCert)} /></label>
            </div>
            <div>
              <label>Private Key (.pem): <input type="file" accept=".pem" onChange={handleFile(setKey)} /></label>
            </div>
            <button onClick={handleSend} style={{ marginTop: 16 }}>Send Hello World</button>
            <pre style={{ marginTop: 24, background: '#eee', padding: 16 }}>
              {response ? JSON.stringify(response, null, 2) : 'No response yet.'}
            </pre>
          </div>
        </main>
        <aside className="vdt-right-panel">ResponseViewer Placeholder</aside>
      </div>
      {settingsOpen && (
        <div className="vdt-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="vdt-modal" onClick={e => e.stopPropagation()}>
            <button className="vdt-modal-close" onClick={() => setSettingsOpen(false)}>&times;</button>
            <AuthForm />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
