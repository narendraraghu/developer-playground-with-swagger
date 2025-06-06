import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCog, FaKey, FaShieldAlt, FaNetworkWired, FaLock, FaGlobe, FaUpload } from 'react-icons/fa';
import MutualAuthSettings from './MutualAuthSettings';

const SettingsPanel = ({ 
  showSettings, 
  settingsSaved, 
  setSettingsSaved, 
  mleAvailable, 
  setMleAvailable, 
  loading, 
  setLoading, 
  setError, 
  setShowSettings,
  selectedEnvironment,
  setSelectedEnvironment,
  environments
}) => {
  const [settings, setSettings] = useState({
    userId: '',
    password: '',
    sslServerCert: '',
    sslClientKey: '',
    keyId: '',
    mleServerKey: '',
    mleClientKey: '',
    useProxy: false,
    proxyHost: '',
    proxyPort: '',
    proxyUsername: '',
    proxyPassword: '',
    apiKey: '',
    sharedSecret: '',
    resourcePath: '',
  });
  const [authMethod, setAuthMethod] = useState('mutualAuth');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // File name states
  const [mleServerKeyFile, setMleServerKeyFile] = useState('');
  const [mleClientKeyFile, setMleClientKeyFile] = useState('');

  // File upload success states
  const [mleServerKeySuccess, setMleServerKeySuccess] = useState(false);
  const [mleClientKeySuccess, setMleClientKeySuccess] = useState(false);

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/visa/load-settings');
        const data = await response.json();
        if (data.settings) {
          setSettings({
            userId: data.settings.userId || '',
            password: data.settings.password || '',
            sslServerCert: data.settings.sslServerCert || '',
            sslClientKey: data.settings.sslClientKey || '',
            keyId: data.settings.keyId || '',
            mleServerKey: data.settings.mleServerKey || '',
            mleClientKey: data.settings.mleClientKey || '',
            useProxy: data.settings.useProxy || false,
            proxyHost: data.settings.proxyHost || '',
            proxyPort: data.settings.proxyPort || '',
            proxyUsername: data.settings.proxyUsername || '',
            proxyPassword: data.settings.proxyPassword || '',
            apiKey: data.settings.apiKey || '',
            sharedSecret: data.settings.sharedSecret || '',
            resourcePath: data.settings.resourcePath || '',
          });
          setAuthMethod(data.authMethod || 'mutualAuth');
          setSettingsSaved(true);
          if(data.settings.mleServerKey) setMleServerKeyFile('file loaded');
          if(data.settings.mleClientKey) setMleClientKeyFile('file loaded');
        } else {
          setSettingsSaved(false);
        }
        if (data.mleAvailable !== undefined) {
          setMleAvailable(data.mleAvailable);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setSettingsSaved(false);
      }
    };

    loadSettings();
  }, [setSettingsSaved, setMleAvailable]);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        switch (type) {
          case 'sslServerCert':
            setSettings(prev => ({ ...prev, sslServerCert: content }));
            break;
          case 'sslClientKey':
            setSettings(prev => ({ ...prev, sslClientKey: content }));
            break;
          case 'mleServerKey':
            setSettings(prev => ({ ...prev, mleServerKey: content }));
            setMleServerKeyFile(file.name);
            setMleServerKeySuccess(true);
            setTimeout(() => setMleServerKeySuccess(false), 3000);
            break;
          case 'mleClientKey':
            setSettings(prev => ({ ...prev, mleClientKey: content }));
            setMleClientKeyFile(file.name);
            setMleClientKeySuccess(true);
            setTimeout(() => setMleClientKeySuccess(false), 3000);
            break;
          default:
            break;
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveSettings = async () => {
    let currentSettings = {};
    let missingFields = [];

    if (authMethod === 'mutualAuth') {
      currentSettings = {
        ...settings,
      };
      const requiredMutualAuthFields = {
        userId: 'User ID',
        password: 'Password',
      };
      missingFields = missingFields.concat(Object.entries(requiredMutualAuthFields)
        .filter(([key]) => !settings[key])
        .map(([_, label]) => label));

      if (!settings.sslServerCert) missingFields.push('Visa SSL Server Certificate file');
      if (!settings.sslClientKey) missingFields.push('Client SSL Private Key file');
    } else {
      currentSettings = {
        ...settings,
        userId: '',
        password: '',
        sslServerCert: '',
        sslClientKey: '',
      };
      const requiredXPayTokenFields = {
        apiKey: 'API Key',
        sharedSecret: 'Shared Secret',
        resourcePath: 'Resource Path',
      };
      missingFields = missingFields.concat(Object.entries(requiredXPayTokenFields)
        .filter(([key]) => !settings[key])
        .map(([_, label]) => label));
    }

    if (mleAvailable) {
      const requiredMleFields = {
        keyId: 'MLE Key ID',
      };
      missingFields = missingFields.concat(Object.entries(requiredMleFields)
        .filter(([key]) => !settings[key])
        .map(([_, label]) => label));

      if (!settings.mleServerKey) missingFields.push('Visa MLE Public Key file');
      if (!settings.mleClientKey) missingFields.push('Your MLE Private Key file');
    }

    if (settings.useProxy) {
      const requiredProxyFields = {
        proxyHost: 'Proxy Host',
        proxyPort: 'Proxy Port',
      };
      missingFields = missingFields.concat(Object.entries(requiredProxyFields)
        .filter(([key]) => !settings[key])
        .map(([_, label]) => label));
    }

    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      setSettingsSaved(false);
      setShowSuccessMessage(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/visa/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...currentSettings,
          authMethod,
          environment: selectedEnvironment
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to save settings');
      }

      if (data.mleAvailable !== undefined) {
        setMleAvailable(data.mleAvailable);
      }

      setSettingsSaved(true);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError(error.message);
      setSettingsSaved(false);
      setShowSuccessMessage(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSettings = async () => {
    setSettings({
      userId: '',
      password: '',
      sslServerCert: '',
      sslClientKey: '',
      keyId: '',
      mleServerKey: '',
      mleClientKey: '',
      useProxy: false,
      proxyHost: '',
      proxyPort: '',
      proxyUsername: '',
      proxyPassword: '',
      apiKey: '',
      sharedSecret: '',
      resourcePath: '',
    });
    setAuthMethod('mutualAuth');
    setSettingsSaved(false);

    try {
      const response = await fetch('http://localhost:3001/api/visa/clear-settings', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to clear settings on backend');
      }

      console.log('Settings cleared on backend!');
      setShowSettings(false);
    } catch (error) {
      console.error('Error clearing settings on backend:', error);
    }
  };

  return (
    <motion.div
      className="settings-panel"
      initial={{ opacity: 0, x: showSettings ? 0 : -20 }}
      animate={{ opacity: showSettings ? 1 : 0, x: showSettings ? 0 : -20 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: showSettings ? 'auto' : 'none' }}
    >
      <div className="settings-header-with-toggle">
        <h2>Settings</h2>
        <div className="auth-method-toggle-container">
          <label className="switch">
            <input
              type="checkbox"
              checked={authMethod === 'xpayToken'}
              onChange={(e) => setAuthMethod(e.target.checked ? 'xpayToken' : 'mutualAuth')}
            />
            <span className="slider round"></span>
          </label>
          <span>Use X-Pay-Token Authentication</span>
        </div>
      </div>

      <div className="settings-content-horizontal">

        {/* Mutual Authentication Settings */}
        {authMethod === 'mutualAuth' && (
          <MutualAuthSettings
            settings={settings}
            setSettings={setSettings}
            handleFileChange={handleFileChange}
          />
        )}

        {/* X-Pay-Token Settings - Conditionally visible */}
        {authMethod === 'xpayToken' && (
          <div className="settings-section">
            <div className="section-header">
              <FaKey /> X-Pay-Token Configuration
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="text"
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                required={authMethod === 'xpayToken'} // Required only if X-Pay-Token is active
              />
            </div>
            <div className="form-group">
              <label>Shared Secret</label>
              <input
                type="password"
                value={settings.sharedSecret}
                onChange={(e) => setSettings(prev => ({ ...prev, sharedSecret: e.target.value }))}
                required={authMethod === 'xpayToken'} // Required only if X-Pay-Token is active
              />
            </div>
            <div className="form-group">
              <label>Resource Path</label>
              <input
                type="text"
                value={settings.resourcePath}
                onChange={(e) => setSettings(prev => ({ ...prev, resourcePath: e.target.value }))}
                placeholder="e.g., helloworld"
                required={authMethod === 'xpayToken'} // Required only if X-Pay-Token is active
              />
            </div>
          </div>
        )}

        {/* Message Level Encryption Settings */}
        {mleAvailable && (
          <div className="settings-section">
            <h3><FaShieldAlt /> Message Level Encryption (MLE)</h3>
            <p>Configure keys for encrypting and decrypting sensitive data.</p>
            
            {/* MLE Key ID Input (Moved Up) */}
            <div className="input-group">
              <label htmlFor="keyId">MLE Key ID:</label>
              <input
                type="text"
                id="keyId"
                value={settings.keyId}
                onChange={(e) => setSettings(prev => ({ ...prev, keyId: e.target.value }))}
                placeholder="Enter your MLE Key ID"
              />
            </div>

            <div className="upload-container">
              <div className="file-upload-group">
                {/* File label */}
                <span className="file-upload-label">Visa MLE Public Key:</span>
                
                {/* Choose file button */}
                <label htmlFor="mle-server-key-upload" className="file-upload-choice">
                  Choose file
                </label>
                
                {/* File status */}
                <span className="file-name">
                  {mleServerKeyFile || 'No key chosen'}
                </span>
                {mleServerKeySuccess && <span className="upload-success">Uploaded successfully</span>}
                
                <input
                  type="file"
                  accept=".pem,.cer,.crt"
                  onChange={(e) => handleFileChange(e, 'mleServerKey')}
                  style={{ display: 'none' }}
                  id="mle-server-key-upload"
                />
              </div>

              <div className="file-upload-group">
                {/* File label */}
                <span className="file-upload-label">Your MLE Private Key:</span>

                {/* Choose file button */}
                <label htmlFor="mle-client-key-upload" className="file-upload-choice">
                  Choose file
                </label>

                {/* File status */}
                <span className="file-name">
                  {mleClientKeyFile || 'No key chosen'}
                </span>
                {mleClientKeySuccess && <span className="upload-success">Uploaded successfully</span>}

                <input
                  type="file"
                  accept=".pem,.key"
                  onChange={(e) => handleFileChange(e, 'mleClientKey')}
                  style={{ display: 'none' }}
                  id="mle-client-key-upload"
                />
              </div>
            </div>
          </div>
        )}

        {/* Environment Selection */}
        <div className="settings-section">
          <h3><FaGlobe /> Environment</h3>
          <div className="environment-selector">
            <label htmlFor="environment-select">Select Environment:</label>
            <select
              id="environment-select"
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
            >
              {Object.keys(environments).map(env => (
                <option key={env} value={env}>{env.charAt(0).toUpperCase() + env.slice(1)}</option>
              ))}
            </select>
          </div>
          <p>Base URL: {environments[selectedEnvironment]}</p>

          {/* Proxy Settings (Moved Here) */}
          <div className="settings-section nested">
              <h4><FaNetworkWired /> Proxy Settings</h4>
              <div className="input-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.useProxy}
                    onChange={(e) => setSettings(prev => ({ ...prev, useProxy: e.target.checked }))}
                  />
                  Use Proxy
                </label>
              </div>

              {settings.useProxy && (
                <>
                  <div className="input-group">
                    <label htmlFor="proxyHost">Proxy Host:</label>
                    <input
                      type="text"
                      id="proxyHost"
                      value={settings.proxyHost}
                      onChange={(e) => setSettings(prev => ({ ...prev, proxyHost: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="proxyPort">Proxy Port:</label>
                    <input
                      type="number"
                      id="proxyPort"
                      value={settings.proxyPort}
                      onChange={(e) => setSettings(prev => ({ ...prev, proxyPort: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="proxyUsername">Proxy Username (Optional):</label>
                    <input
                      type="text"
                      id="proxyUsername"
                      value={settings.proxyUsername}
                      onChange={(e) => setSettings(prev => ({ ...prev, proxyUsername: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="proxyPassword">Proxy Password (Optional):</label>
                    <input
                      type="password"
                      id="proxyPassword"
                      value={settings.proxyPassword}
                      onChange={(e) => setSettings(prev => ({ ...prev, proxyPassword: e.target.value }))}
                    />
                  </div>
                </>
              )}
          </div>

        </div>

      </div>

      {/* Action Buttons */}
      <div className="settings-buttons">
        <button
          className="settings-button"
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          className="settings-button reset"
          onClick={handleResetSettings}
          disabled={loading}
        >
          Reset Settings
        </button>
        <button
          className="settings-button close"
          onClick={() => setShowSettings(false)}
          disabled={loading}
        >
          Close
        </button>
      </div>

      {showSuccessMessage && (
        <motion.div
          className="save-success-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          Settings saved successfully!
        </motion.div>
      )}
    </motion.div>
  );
};

export default SettingsPanel; 