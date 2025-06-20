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
  environments,
  authMethod,
  setAuthMethod
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
          // Use the authMethod from props (which is persisted in localStorage)
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

    // Only require MLE fields if MLE keys are actually provided
    if (mleAvailable && (settings.mleServerKey || settings.mleClientKey)) {
      if (!settings.keyId) missingFields.push('MLE Key ID');
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

      if (response.ok) {
        setSettingsSaved(true);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save settings');
        setSettingsSaved(false);
        setShowSuccessMessage(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings. Please try again.');
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
        <div className="auth-method-toggle-container">
          <span>Use X-Pay-Token Authentication</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={authMethod === 'xpayToken'}
              onChange={(e) => setAuthMethod(e.target.checked ? 'xpayToken' : 'mutualAuth')}
            />
            <span className="slider round"></span>
          </label>
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
            <p className="auth-description">
              X-Pay-Token authentication uses your API Key, Shared Secret, and Resource Path to generate a secure token for API requests. 
              The token is automatically generated and included in the X-PAY-TOKEN header.
            </p>
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
            <div className="section-header">
              <FaShieldAlt /> Message Level Encryption (MLE)
            </div>
            <div className="form-group">
              <label>MLE Key ID</label>
              <input
                type="text"
                value={settings.keyId}
                onChange={(e) => setSettings(prev => ({ ...prev, keyId: e.target.value }))}
                required={mleAvailable}
              />
            </div>
            <div className="form-group">
              <label>Visa MLE Public Key</label>
              <div className="file-input-container">
                <input
                  type="file"
                  accept=".pem,.cer,.crt"
                  onChange={(e) => handleFileChange(e, 'mleServerKey')}
                  className="file-input"
                />
                <span className="file-name">{mleServerKeyFile || 'Choose file'}</span>
              </div>
              {mleServerKeySuccess && (
                <div className="success-message">MLE server key loaded successfully!</div>
              )}
            </div>
            <div className="form-group">
              <label>Your MLE Private Key</label>
              <div className="file-input-container">
                <input
                  type="file"
                  accept=".pem,.key"
                  onChange={(e) => handleFileChange(e, 'mleClientKey')}
                  className="file-input"
                />
                <span className="file-name">{mleClientKeyFile || 'Choose file'}</span>
              </div>
              {mleClientKeySuccess && (
                <div className="success-message">MLE client key loaded successfully!</div>
              )}
            </div>
          </div>
        )}

        {/* Environment Settings */}
        <div className="settings-section">
          <div className="section-header">
            <FaGlobe /> Environment Configuration
          </div>
          <div className="environment-selector">
            <label>Environment</label>
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="certification">Certification</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div className="environment-selector">
            <label>Base URL</label>
            <input
              type="text"
              value={environments[selectedEnvironment]}
              readOnly
              className="environment-url"
            />
          </div>
        </div>

        {/* Proxy Settings */}
        <div className="settings-section">
          <div className="section-header">
            <FaNetworkWired /> Proxy Configuration
          </div>
          <div className="form-group">
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
            <div className="settings-section nested">
              <div className="input-group">
                <label>Proxy Host</label>
                <input
                  type="text"
                  value={settings.proxyHost}
                  onChange={(e) => setSettings(prev => ({ ...prev, proxyHost: e.target.value }))}
                  required={settings.useProxy}
                />
              </div>
              <div className="input-group">
                <label>Proxy Port</label>
                <input
                  type="number"
                  value={settings.proxyPort}
                  onChange={(e) => setSettings(prev => ({ ...prev, proxyPort: e.target.value }))}
                  required={settings.useProxy}
                />
              </div>
              <div className="input-group">
                <label>Proxy Username (Optional)</label>
                <input
                  type="text"
                  value={settings.proxyUsername}
                  onChange={(e) => setSettings(prev => ({ ...prev, proxyUsername: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Proxy Password (Optional)</label>
                <input
                  type="password"
                  value={settings.proxyPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, proxyPassword: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-buttons">
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={loading}
          className="settings-button"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          type="button"
          onClick={handleResetSettings}
          className="settings-button reset"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(false)}
          className="settings-button close"
        >
          Close
        </button>
      </div>

      {showSuccessMessage && (
        <div className="save-success-message">
          Settings saved successfully!
        </div>
      )}
    </motion.div>
  );
};

export default SettingsPanel; 