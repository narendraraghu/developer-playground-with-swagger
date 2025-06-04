import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCog, FaKey, FaShieldAlt, FaNetworkWired, FaLock } from 'react-icons/fa';
import MutualAuthSettings from './MutualAuthSettings';
import XPayTokenSettings from './XPayTokenSettings';

const SettingsPanel = ({ showSettings, settingsSaved, setSettingsSaved, mleAvailable, setMleAvailable, loading, setLoading, setError }) => {
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
    proxyPassword: ''
  });
  const [xpaySettings, setXPaySettings] = useState({
    apiKey: '',
    sharedSecret: '',
    resourcePath: '',
  });
  const [authMethod, setAuthMethod] = useState('mutualAuth');

  // File name states (needed for display in UI)
  const [mleServerKeyFile, setMleServerKeyFile] = useState('');
  const [mleClientKeyFile, setMleClientKeyFile] = useState('');

  // File upload success states
  const [mleServerKeySuccess, setMleServerKeySuccess] = useState(false);
  const [mleClientKeySuccess, setMleClientKeySuccess] = useState(false);

  // Load saved settings on component mount - This logic might need to be in App.js or handled differently
  // depending on how settings are loaded and shared.
  // For now, keeping it here, but might refactor later.
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/visa/load-settings');
        const data = await response.json();
        if (data.settings) {
          // Assuming the backend saves and returns both settings and xpaySettings
          setSettings(data.settings);
          setXPaySettings(data.xpaySettings || { apiKey: '', sharedSecret: '', resourcePath: '' });
          setAuthMethod(data.authMethod || 'mutualAuth');
          setSettingsSaved(true);
           // Update file names for display if content is loaded
          if(data.settings.mleServerKey) setMleServerKeyFile('file loaded'); // Placeholder name
          if(data.settings.mleClientKey) setMleClientKeyFile('file loaded'); // Placeholder name

        } else {
             // If no settings are loaded, ensure settingsSaved is false
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
  }, [setSettingsSaved, setMleAvailable]); // Added dependencies


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
    // Clear previous errors
    // setError(null); // Error state is in App.js, will need to be passed as prop

    let currentSettings = {};
    let missingFields = [];

    // Validate authentication specific fields and construct combined settings object
    if (authMethod === 'mutualAuth') {
      currentSettings = {
        ...settings,
        // Ensure xpaySettings are not sent when mutualAuth is selected
        apiKey: '',
        sharedSecret: '',
        resourcePath: '',
      };
      // Required fields for Mutual Authentication
      const requiredMutualAuthFields = {
        userId: 'User ID',
        password: 'Password',
        // sslServerCert: 'Visa SSL Server Certificate', // File content check below
        // sslClientKey: 'Client SSL Private Key', // File content check below
      };
      missingFields = missingFields.concat(Object.entries(requiredMutualAuthFields)
        .filter(([key]) => !settings[key])
        .map(([_, label]) => label));

         // Validate SSL Certificates file uploads by checking content state
        if (!settings.sslServerCert) missingFields.push('Visa SSL Server Certificate file');
        if (!settings.sslClientKey) missingFields.push('Client SSL Private Key file');


    } else if (authMethod === 'xpayToken') {
      currentSettings = {
        ...xpaySettings,
        // Ensure mutual auth settings are not sent when xpayToken is selected
        userId: '',
        password: '',
        sslServerCert: '',
        sslClientKey: '',
         // Include MLE and Proxy settings from the settings state (these are always in 'settings')
        keyId: settings.keyId,
        mleServerKey: settings.mleServerKey,
        mleClientKey: settings.mleClientKey,
        useProxy: settings.useProxy,
        proxyHost: settings.proxyHost,
        proxyPort: settings.proxyPort,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword,
      };
      // Required fields for X-Pay-Token
      const requiredXPayTokenFields = {
        apiKey: 'API Key',
        sharedSecret: 'Shared Secret',
        resourcePath: 'Resource Path',
      };
       missingFields = missingFields.concat(Object.entries(requiredXPayTokenFields)
        .filter(([key]) => !xpaySettings[key])
        .map(([_, label]) => label));
    }

    // Validate always visible sections (MLE and Proxy) if applicable
    if (mleAvailable) {
      const requiredMleFields = {
        keyId: 'MLE Key ID',
      };
      missingFields = missingFields.concat(Object.entries(requiredMleFields)
         .filter(([key]) => !settings[key])
         .map(([_, label]) => label));

      // Validate MLE file uploads by checking content state
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
      // setError(`Please fill in all required fields: ${missingFields.join(', ')}`); // Error state in App.js
       console.error(`Missing fields: ${missingFields.join(', ')}`); // Log for debugging
       // Need to pass setError as a prop

      // Keep settingsSaved as false if there are missing fields
      setSettingsSaved(false);
      return;
    }

    try {
      // setLoading(true); // Loading state in App.js, will need to be passed as prop
       console.log('Attempting to save settings:', {...currentSettings, authMethod}); // Log payload

      // Include the authentication method in the payload sent to the backend
      const response = await fetch('http://localhost:3001/api/visa/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...currentSettings, authMethod})
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
      // setError(null); // Error state in App.js
      // setShowSettings(false); // Keep settings open after saving
      console.log('Settings saved successfully!'); // Log success

    } catch (error) {
      console.error('Failed to save settings:', error);
      // setError(error.message); // Error state in App.js
      // Keep settingsSaved as false if there's an error
      setSettingsSaved(false);
    } finally {
      // setLoading(false); // Loading state in App.js
    }
  };

  const handleResetSettings = async () => {
     // Clear Mutual Auth, MLE, and Proxy settings in UI
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
      proxyPassword: ''
    });
    // Clear X-Pay-Token settings in UI
    setXPaySettings({
      apiKey: '',
      sharedSecret: '',
      resourcePath: '',
    });
    // Reset authentication method to default in UI
    setAuthMethod('mutualAuth');
    // Mark settings as not saved in UI
    setSettingsSaved(false);
    // setShowSettings(false);

    // Call backend endpoint to clear settings on the server
    try {
      // setLoading(true); // Loading state in App.js
      const response = await fetch('http://localhost:3001/api/visa/clear-settings', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to clear settings on backend');
      }

      console.log('Settings cleared on backend!'); // Log success

    } catch (error) {
      console.error('Error clearing settings on backend:', error);
      // setError(error.message); // Error state in App.js
    } finally {
      // setLoading(false); // Loading state in App.js
    }
  };

  return (
     showSettings && (
          <motion.div 
            className="settings-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* New settings panel header with toggle switch */}
            <div className="settings-panel-header">
              <h2>Settings</h2>
              {/* Authentication method toggle switch */}
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

            {/* New container for horizontal settings sections */}
            <div className="settings-content-horizontal">
              {/* Conditionally render authentication specific settings */}
              {authMethod === 'mutualAuth' ? (
                <MutualAuthSettings 
                  settings={settings} 
                  setSettings={setSettings} 
                  handleFileChange={handleFileChange} 
                />
              ) : (
                <XPayTokenSettings 
                  xpaySettings={xpaySettings} 
                  setXPaySettings={setXPaySettings} 
                />
              )}

              {/* Message Level Encryption Section (Always visible) */}
              <div className="settings-section">
                <div className="section-header">
                  <FaShieldAlt /> Message Level Encryption {mleAvailable ? '' : '(Not Available)'}
                </div>
                {mleAvailable ? (
                  <>
                    <div className="form-group">
                      <label data-tooltip="Key ID can be copied from the MLE section in the Credentials tab">
                        Key ID
                      </label>
                      <input
                        type="text"
                        value={settings.keyId}
                        onChange={(e) => setSettings(prev => ({ ...prev, keyId: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label data-tooltip="Upload your Server Encryption Certificate">
                        Visa MLE Public Key
                      </label>
                      <div className="file-input-container">
                        <input
                          type="file"
                          accept=".pem,.key"
                          onChange={(e) => handleFileChange(e, 'mleServerKey')}
                          className="file-input"
                        />
                        <span className="file-name">{mleServerKeyFile || 'Choose file'}</span>
                      </div>
                      {mleServerKeySuccess && (
                        <div className="success-message">MLE Public Key loaded successfully!</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label data-tooltip="Your MLE Private Key is the private key generated at the time of MLE certificate creation">
                        Your MLE Private Key
                      </label>
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
                        <div className="success-message">MLE Private Key loaded successfully!</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mle-disabled-message">
                    Message Level Encryption is not available. Please install the 'jose' package to enable MLE support.
                  </div>
                )}
              </div>

              {/* Proxy Settings Section (Always visible) */}
              <div className="settings-section">
                <div className="section-header">
                  <FaNetworkWired /> Proxy Settings
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.useProxy}
                      onChange={(e) => {
                        const useProxy = e.target.checked;
                        setSettings(prev => ({
                          ...prev,
                          useProxy,
                          // Clear proxy settings when disabled
                          ...(useProxy ? {} : {
                            proxyHost: '',
                            proxyPort: '',
                            proxyUsername: '',
                            proxyPassword: ''
                          })
                        }));
                      }}
                    />
                    Enable Proxy
                  </label>
                </div>
                {settings.useProxy && (
                  <div className="proxy-settings">
                    <div className="form-group">
                      <label data-tooltip="Enter the proxy server hostname or IP address (e.g., proxy.example.com)">
                        Proxy Host
                      </label>
                      <input
                        type="text"
                        value={settings.proxyHost}
                        onChange={(e) => setSettings(prev => ({ ...prev, proxyHost: e.target.value.trim() }))}
                        placeholder="e.g., proxy.example.com"
                        required={settings.useProxy}
                        pattern="^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$|^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$"
                          title="Enter a valid hostname or IP address"
                        />
                      </div>
                      <div className="form-group">
                        <label data-tooltip="Enter the proxy server port number (1-65535)">
                          Proxy Port
                        </label>
                        <input
                          type="number"
                          value={settings.proxyPort}
                          onChange={(e) => {
                            const port = e.target.value;
                            if (port === '' || (port >= 1 && port <= 65535)) {
                              setSettings(prev => ({ ...prev, proxyPort: port }));
                            }
                          }}
                          placeholder="e.g., 8080"
                          min="1"
                          max="65535"
                          required={settings.useProxy}
                        />
                      </div>
                      <div className="form-group">
                        <label data-tooltip="Optional: Enter proxy authentication username if required">
                          Proxy Username (Optional)
                        </label>
                        <input
                          type="text"
                          value={settings.proxyUsername}
                          onChange={(e) => setSettings(prev => ({ ...prev, proxyUsername: e.target.value.trim() }))}
                          placeholder="Enter username if required"
                        />
                      </div>
                      <div className="form-group">
                        <label data-tooltip="Optional: Enter proxy authentication password if required">
                          Proxy Password (Optional)
                        </label>
                        <input
                          type="password"
                          value={settings.proxyPassword}
                          onChange={(e) => setSettings(prev => ({ ...prev, proxyPassword: e.target.value }))}
                          placeholder="Enter password if required"
                        />
                      </div>
                      {settings.proxyUsername && !settings.proxyPassword && (
                        <div className="warning-message">
                          ⚠️ Proxy username is set but password is missing. Authentication may fail.
                        </div>
                      )}
                      {settings.useProxy && (!settings.proxyHost || !settings.proxyPort) && (
                        <div className="warning-message">
                          ⚠️ Please provide both proxy host and port to enable proxy.
                        </div>
                      )}
                    </div>
                  )}
                </div>

            {/* Close the new horizontal container */}
            </div>

            {/* Buttons container moved below the horizontal sections */}
            <div className="settings-buttons-container">
              <button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="save-settings-button settings-button"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
              <button 
                onClick={handleResetSettings}
                disabled={loading}
                className="reset-settings-button settings-button"
              >
                Reset Settings
              </button>
            </div>


          </motion.div>
        )
  );
};

export default SettingsPanel; 