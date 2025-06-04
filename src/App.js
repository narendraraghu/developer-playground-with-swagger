import React, { useState, useEffect } from 'react';
import './App.css';
import { FaCog, FaPaperPlane, FaCode, FaExchangeAlt, FaList } from 'react-icons/fa';
import { motion } from 'framer-motion';

// Import the new components
import SettingsPanel from './components/SettingsPanel';
import CollectionPanel from './components/CollectionPanel';
import ApiPanel from './components/ApiPanel';

// ErrorDisplay is now used within ApiPanel, no need to import here if it's there
// import ErrorDisplay from './components/ErrorDisplay';

function App() {
  // Keep top-level state here that controls overall app behavior and is shared
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCollection, setShowCollection] = useState(false);

  // Keep API request/response state here
  const [apiUrl, setApiUrl] = useState('https://sandbox.api.visa.com/vdp/helloworld');
  const [method, setMethod] = useState('GET');
  const [payload, setPayload] = useState('');
  const [response, setResponse] = useState(null);
  const [responseHeaders, setResponseHeaders] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

   // Keep settings state here to be passed to both SettingsPanel and ApiPanel
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
  const [authMethod, setAuthMethod] = useState('mutualAuth'); // Default to mutualAuth
  const [mleAvailable, setMleAvailable] = useState(true);

  // Remove handleFileChange, handleSaveSettings, handleResetSettings - these will be in SettingsPanel
  // Remove handleMethodChange, handleSubmit - these will be in ApiPanel
  // Remove handlePostmanUpload, handleRequestSelect, handleRemoveCollection - these will be in CollectionPanel

  // Add a handler in App.js to receive selected request data from CollectionPanel
  const handleCollectionRequestSelect = (requestData) => {
    setApiUrl(requestData.apiUrl);
    setMethod(requestData.method);
    setPayload(requestData.payload);
    // Clear any previous response/error when a new request is selected
    setResponse(null);
    setResponseHeaders(null);
    setError(null);
  };

    // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/visa/load-settings');
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
           // Ensure xpaySettings and authMethod are also loaded if saved
           setXPaySettings(data.xpaySettings || { apiKey: '', sharedSecret: '', resourcePath: '' });
           setAuthMethod(data.authMethod || 'mutualAuth');

          setSettingsSaved(true);
        } else {
             // If no settings are loaded, ensure settingsSaved is false
            setSettingsSaved(false);
        }
        if (data.mleAvailable !== undefined) {
          setMleAvailable(data.mleAvailable);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
         setSettingsSaved(false); // Ensure settingsSaved is false on error
      }
    };

    loadSettings();
  }, []); // Empty dependency array means this effect runs only once on mount


  return (
    <div className="App">
      <header className="App-header">
        <h1>Visa Developer Sandbox Simulator</h1>
        <div className="header-buttons">
          <motion.button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaCog /> {showSettings ? 'Hide Settings' : 'Show Settings'}
          </motion.button>
          <motion.button
            className="collection-toggle"
            onClick={() => setShowCollection(!showCollection)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaList /> {showCollection ? 'Hide Collection' : 'Show Collection'}
          </motion.button>
        </div>
      </header>

      <main className="App-main">
        {/* Render SettingsPanel */}
        <SettingsPanel
          showSettings={showSettings}
          settings={settings}
          setSettings={setSettings}
          xpaySettings={xpaySettings}
          setXPaySettings={setXPaySettings}
          authMethod={authMethod}
          setAuthMethod={setAuthMethod}
          settingsSaved={settingsSaved}
          setSettingsSaved={setSettingsSaved}
          mleAvailable={mleAvailable}
          setMleAvailable={setMleAvailable}
          // Pass loading and setError down if needed in Save/Reset handlers
          loading={loading} // Pass loading state
          setLoading={setLoading} // Pass setLoading to allow SettingsPanel to indicate saving/resetting is in progress
          setError={setError} // Pass setError to allow SettingsPanel to display errors
        />

        <div className="main-container">
          {/* Render CollectionPanel */}
          <CollectionPanel
            showCollection={showCollection}
            onRequestSelect={handleCollectionRequestSelect} // Pass the handler to update App state
            setError={setError} // Pass setError to CollectionPanel
          />

          {/* Render ApiPanel */}
          <ApiPanel
            apiUrl={apiUrl}
            setApiUrl={setApiUrl}
            method={method}
            setMethod={setMethod}
            payload={payload}
            setPayload={setPayload}
            loading={loading}
            setLoading={setLoading}
            response={response}
            setResponse={setResponse}
            responseHeaders={responseHeaders}
            setResponseHeaders={setResponseHeaders}
            error={error}
            setError={setError}
            settingsSaved={settingsSaved}
            authMethod={authMethod}
            settings={settings} // Pass settings state
            xpaySettings={xpaySettings} // Pass xpaySettings state
          />
        </div>
      </main>
    </div>
  );
}

export default App;