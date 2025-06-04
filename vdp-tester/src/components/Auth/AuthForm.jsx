import React, { useState } from 'react';
import { useCredentials } from '../../context/CredentialContext';

const cardStyle = {
  background: '#f8fafd',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  padding: '24px',
  marginBottom: '24px',
  maxWidth: '420px',
  marginLeft: 'auto',
  marginRight: 'auto',
};

const labelStyle = {
  display: 'block',
  fontWeight: 500,
  marginBottom: 6,
  marginTop: 12,
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid #cfd8dc',
  marginBottom: '8px',
  fontSize: '1rem',
};

const AuthForm = () => {
  const { credentials, setCredentials } = useCredentials();
  // Mutual SSL
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [sslSaved, setSslSaved] = useState(false);

  // API Key + Shared Secret
  const [apiKey, setApiKey] = useState('');
  const [sharedSecret, setSharedSecret] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Handlers for Mutual SSL
  const handleCertChange = (e) => {
    setCertFile(e.target.files[0]);
    setSslSaved(false);
  };
  const handleKeyChange = (e) => {
    setKeyFile(e.target.files[0]);
    setSslSaved(false);
  };
  const handleSslSave = () => {
    if (certFile && keyFile && userId && password) {
      setCredentials(prev => ({
        ...prev,
        certFile,
        keyFile,
        userId,
        password,
      }));
      setSslSaved(true);
    }
  };

  // Handlers for API Key + Shared Secret
  const handleApiKeySave = () => {
    if (apiKey && sharedSecret) {
      setCredentials(prev => ({
        ...prev,
        apiKey,
        sharedSecret,
      }));
      setApiKeySaved(true);
    }
  };

  return (
    <div style={{ padding: '8px 0 24px 0' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#1a237e', letterSpacing: 1 }}>Settings</h2>
      {/* Mutual SSL Section */}
      <section style={cardStyle}>
        <h3 style={{ color: '#0d47a1', marginBottom: 12 }}>Mutual SSL Authentication</h3>
        <p style={{ color: '#607d8b', marginBottom: 18, fontSize: '0.98rem' }}>
          Upload your client certificate, private key, and enter your User ID and Password for Visa mutual authentication.
        </p>
        <label style={labelStyle}>Public Certificate (.pem/.crt/.jks/.p12):</label>
        <input type="file" accept=".pem,.crt,.jks,.p12" onChange={handleCertChange} style={{ marginBottom: 8 }} />
        {certFile && <div style={{ color: '#388e3c', fontSize: '0.95rem', marginBottom: 8 }}>Selected: {certFile.name}</div>}
        <label style={labelStyle}>Private Key (.pem/.key):</label>
        <input type="file" accept=".pem,.key" onChange={handleKeyChange} style={{ marginBottom: 8 }} />
        {keyFile && <div style={{ color: '#388e3c', fontSize: '0.95rem', marginBottom: 8 }}>Selected: {keyFile.name}</div>}
        <label style={labelStyle}>User ID:</label>
        <input type="text" value={userId} onChange={e => { setUserId(e.target.value); setSslSaved(false); }} style={inputStyle} placeholder="Enter User ID" />
        <label style={labelStyle}>Password:</label>
        <input type="password" value={password} onChange={e => { setPassword(e.target.value); setSslSaved(false); }} style={inputStyle} placeholder="Enter Password" />
        <button onClick={handleSslSave} disabled={!(certFile && keyFile && userId && password)} style={{ marginTop: 16, width: '100%', background: '#1a237e', color: '#fff', fontWeight: 600, padding: '10px 0', border: 'none', borderRadius: 4, fontSize: '1rem', cursor: !(certFile && keyFile && userId && password) ? 'not-allowed' : 'pointer' }}>
          Save Certificates & Credentials
        </button>
        {sslSaved && <div style={{ color: '#388e3c', marginTop: 12, textAlign: 'center' }}>Certificates and credentials saved for this session.</div>}
      </section>

      {/* API Key + Shared Secret Section */}
      <section style={cardStyle}>
        <h3 style={{ color: '#0d47a1', marginBottom: 12 }}>API Key + Shared Secret</h3>
        <p style={{ color: '#607d8b', marginBottom: 18, fontSize: '0.98rem' }}>
          Enter your Visa API Key and Shared Secret for authentication.
        </p>
        <label style={labelStyle}>API Key:</label>
        <input type="text" value={apiKey} onChange={e => { setApiKey(e.target.value); setApiKeySaved(false); }} style={inputStyle} placeholder="Enter API Key" />
        <label style={labelStyle}>Shared Secret:</label>
        <input type="password" value={sharedSecret} onChange={e => { setSharedSecret(e.target.value); setApiKeySaved(false); }} style={inputStyle} placeholder="Enter Shared Secret" />
        <button onClick={handleApiKeySave} disabled={!(apiKey && sharedSecret)} style={{ marginTop: 16, width: '100%', background: '#1a237e', color: '#fff', fontWeight: 600, padding: '10px 0', border: 'none', borderRadius: 4, fontSize: '1rem', cursor: !(apiKey && sharedSecret) ? 'not-allowed' : 'pointer' }}>
          Save API Key & Secret
        </button>
        {apiKeySaved && <div style={{ color: '#388e3c', marginTop: 12, textAlign: 'center' }}>API Key and Secret saved for this session.</div>}
      </section>
    </div>
  );
};

export default AuthForm; 