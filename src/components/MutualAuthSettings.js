import React, { useState } from 'react';
import { FaKey, FaLock } from 'react-icons/fa';

const MutualAuthSettings = ({ settings, setSettings, handleFileChange }) => {
  // Add state for file names and success messages
  const [sslServerCertFile, setSslServerCertFile] = useState('');
  const [sslClientKeyFile, setSslClientKeyFile] = useState('');
  const [sslServerCertSuccess, setSslServerCertSuccess] = useState(false);
  const [sslClientKeySuccess, setSslClientKeySuccess] = useState(false);

  // Custom file change handler to update file names and show success messages
  const handleSSLFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      handleFileChange(e, type);
      if (type === 'sslServerCert') {
        setSslServerCertFile(file.name);
        setSslServerCertSuccess(true);
        setTimeout(() => setSslServerCertSuccess(false), 3000);
      } else if (type === 'sslClientKey') {
        setSslClientKeyFile(file.name);
        setSslClientKeySuccess(true);
        setTimeout(() => setSslClientKeySuccess(false), 3000);
      }
    }
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <FaKey /> Mutual Authentication
      </div>
      {/* User ID and Password */}
      <div className="form-group">
        <label data-tooltip="UserID can be found in the Credentials sidebar under Two-Way SSL">
          User ID
        </label>
        <input
          type="text"
          value={settings.userId}
          onChange={(e) => setSettings(prev => ({ ...prev, userId: e.target.value }))}
          required
        />
      </div>
      <div className="form-group">
        <label data-tooltip="Password can be found in the Credentials sidebar under Two-Way SSL">
          Password
        </label>
        <input
          type="password"
          value={settings.password}
          onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
          required
        />
      </div>

      {/* SSL Certificates */}
      <div className="section-header">
        <FaLock /> SSL Certificates
      </div>
      <div className="form-group">
        <label data-tooltip="Visa SSL Server Certificate can be found under Action by clicking on Download Certificate">
          Visa SSL Server Certificate
        </label>
        <div className="file-input-container">
          <input
            type="file"
            accept=".pem,.cer,.crt"
            onChange={(e) => handleSSLFileChange(e, 'sslServerCert')}
            className="file-input"
          />
          <span className="file-name">{sslServerCertFile || 'Choose file'}</span>
        </div>
        {sslServerCertSuccess && (
          <div className="success-message">Server certificate loaded successfully!</div>
        )}
      </div>
      <div className="form-group">
        <label data-tooltip="Client SSL Private Key is your project private key downloaded at the time of project creation">
          Client SSL Private Key
        </label>
        <div className="file-input-container">
          <input
            type="file"
            accept=".pem,.key"
            onChange={(e) => handleSSLFileChange(e, 'sslClientKey')}
            className="file-input"
          />
          <span className="file-name">{sslClientKeyFile || 'Choose file'}</span>
        </div>
        {sslClientKeySuccess && (
          <div className="success-message">Client key loaded successfully!</div>
        )}
      </div>
    </div>
  );
};

export default MutualAuthSettings; 