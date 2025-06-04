import React, { useState } from 'react';
import { useCredentials } from '../../context/CredentialContext';

const methodOptions = ['GET', 'POST'];

const RequestBuilder = () => {
  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const { credentials } = useCredentials();

  const handleSend = async () => {
    if (!url) return alert('Please enter an endpoint URL');
    let headersObj = {};
    let bodyObj = undefined;
    try {
      headersObj = headers ? JSON.parse(headers) : {};
    } catch (e) {
      alert('Invalid JSON in headers');
      return;
    }
    try {
      bodyObj = body ? JSON.parse(body) : undefined;
    } catch (e) {
      alert('Invalid JSON in body');
      return;
    }
    try {
      const result = await window.vdpApi.sendRequest(
        {
          method,
          url,
          headers: headersObj,
          body: bodyObj,
        },
        credentials
      );
      alert(JSON.stringify(result, null, 2));
    } catch (err) {
      alert('Request failed: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 32 }}>
      <h2 style={{ color: '#1a237e', marginBottom: 24 }}>API Request Builder</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={method} onChange={e => setMethod(e.target.value)} style={{ fontSize: '1rem', padding: '8px', borderRadius: 4, border: '1px solid #cfd8dc' }}>
          {methodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter endpoint URL" style={{ flex: 1, fontSize: '1rem', padding: '8px', borderRadius: 4, border: '1px solid #cfd8dc' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Headers (JSON):</label>
        <textarea value={headers} onChange={e => setHeaders(e.target.value)} rows={3} placeholder={`{
  "Content-Type": "application/json"
}`} style={{ width: '100%', fontSize: '1rem', padding: 8, borderRadius: 4, border: '1px solid #cfd8dc' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Body (JSON):</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder={`{
  "key": "value"
}`} style={{ width: '100%', fontSize: '1rem', padding: 8, borderRadius: 4, border: '1px solid #cfd8dc' }} />
      </div>
      <button onClick={handleSend} style={{ background: '#1a237e', color: '#fff', fontWeight: 600, padding: '12px 32px', border: 'none', borderRadius: 4, fontSize: '1rem', cursor: 'pointer' }}>
        Send
      </button>
    </div>
  );
};

export default RequestBuilder; 