import React from 'react';
import { FaKey, FaPaperPlane } from 'react-icons/fa'; // Assuming FaPaperPlane might be used for the resource path description icon

const XPayTokenSettings = ({ xpaySettings, setXPaySettings }) => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <FaKey /> X-Pay-Token Configuration
      </div>
      <div className="form-group">
        <label>API Key</label>
        <input
          type="text"
          value={xpaySettings.apiKey}
          onChange={(e) => setXPaySettings(prev => ({ ...prev, apiKey: e.target.value }))}
          required
        />
      </div>
      <div className="form-group">
        <label>Shared Secret</label>
        <input
          type="password"
          value={xpaySettings.sharedSecret}
          onChange={(e) => setXPaySettings(prev => ({ ...prev, sharedSecret: e.target.value }))}
          required
        />
      </div>
      <div className="form-group">
        <label>Resource Path</label>
        <input
          type="text"
          value={xpaySettings.resourcePath}
          onChange={(e) => setXPaySettings(prev => ({ ...prev, resourcePath: e.target.value }))}
          placeholder="e.g., helloworld"
          required
        />
      </div>
    </div>
  );
};

export default XPayTokenSettings; 