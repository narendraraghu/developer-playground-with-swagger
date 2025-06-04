import React from 'react';
import { FaKey, FaLock } from 'react-icons/fa';

const MutualAuthSettings = ({ settings, setSettings, handleFileChange }) => {
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
        <input
          type="file"
          accept=".pem,.cer,.crt"
          onChange={(e) => handleFileChange(e, 'sslServerCert')}
        />
        {settings.sslServerCert && (
          <div className="file-info success-message">✓ Server certificate loaded</div>
        )}
      </div>
      <div className="form-group">
        <label data-tooltip="Client SSL Private Key is your project private key downloaded at the time of project creation">
          Client SSL Private Key
        </label>
        <input
          type="file"
          accept=".pem,.key"
          onChange={(e) => handleFileChange(e, 'sslClientKey')}
        />
        {settings.sslClientKey && (
          <div className="file-info success-message">✓ Client key loaded</div>
        )}
      </div>
    </div>
  );
};

export default MutualAuthSettings; 