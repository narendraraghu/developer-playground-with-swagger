import React, { useState, useEffect } from 'react';
import './App.css';
import ApiPanel from './components/ApiPanel';
import SettingsPanel from './components/SettingsPanel';
import CollectionPanel from './components/CollectionPanel';
import { FaCog, FaList } from 'react-icons/fa';
import errorMapping from './data/error-mapping.json'; // Import the error mapping

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [error, setError] = useState(null);
  const [activeApiUrl, setActiveApiUrl] = useState('');
  const [activeMethod, setActiveMethod] = useState('GET');
  const [activePayload, setActivePayload] = useState('');
  const [activeResponse, setActiveResponse] = useState(null);
  const [activeError, setActiveError] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mleAvailable, setMleAvailable] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState('sandbox');
  
  // Add authentication method state with persistence
  const [authMethod, setAuthMethod] = useState(() => {
    const saved = localStorage.getItem('authMethod');
    return saved || 'mutualAuth';
  });

  // Save auth method to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('authMethod', authMethod);
  }, [authMethod]);

  const environments = {
    sandbox: 'https://sandbox.api.visa.com',
    certification: 'https://cert.api.visa.com',
    production: 'https://api.visa.com'
  };

  const handleRequestSelect = (request) => {
    console.log('App.js received request:', request);
    // Get the base URL from the selected environment
    const baseUrl = environments[selectedEnvironment];
    
    // If the request URL is a relative path, prepend the base URL
    let fullUrl = request.url;
    if (request.url && !request.url.startsWith('http')) {
      fullUrl = `${baseUrl}${request.url.startsWith('/') ? '' : '/'}${request.url}`;
    }
    
    setActiveApiUrl(fullUrl);
    setActiveMethod(request.method);
    let payload = '';
    if (request.body) {
      try {
        payload = typeof request.body === 'object' ? JSON.stringify(request.body, null, 2) : String(request.body);
      } catch (e) {
        console.error('Error stringifying request body:', e);
        payload = String(request.body);
      }
    }
    setActivePayload(payload);
    console.log('App.js activePayload after set:', payload);

    setActiveResponse(null);
    setActiveError(null);
    setError(null);
  };

  const handlePayloadChange = (payload) => {
    setActivePayload(payload);
  };

  const handleSendRequest = async (url, method, payload) => {
    setLoading(true);
    setActiveError(null);
    setActiveResponse(null);
    setError(null);
    
    try {
      // Proxy the request through our backend server
      const response = await fetch('http://localhost:3001/api/visa/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          method,
          payload: method !== 'GET' ? payload : undefined,
          authMethod // Pass the authentication method to the backend
        })
      });

      const data = await response.json();
      
      // Helper function to handle decryption
      const decryptResponseData = async (responseData) => {
        if (responseData?.encData) {
          console.log('Response is encrypted, attempting decryption...');
          try {
            const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ encryptedData: responseData.encData })
            });

            const decryptedData = await decryptResponse.json();

            if (!decryptResponse.ok) {
              throw new Error(decryptedData.details || decryptedData.error || 'Failed to decrypt response');
            }

            console.log('Decryption successful.', decryptedData);
            return decryptedData.decryptedData;
          } catch (decryptError) {
            console.error('Error during decryption:', decryptError);
            setError(`Decryption failed: ${decryptError.message}`);
            setActiveError(`Decryption failed: ${decryptError.message}`);
            return responseData;
          }
        }
        return responseData;
      };

      if (!response.ok) {
        const decryptedData = await decryptResponseData(data.data);
        
        // Attempt to extract error code from decrypted data
        const errorCode = decryptedData?.responseStatus?.code || 
                          decryptedData?.errorCode || 
                          decryptedData?.code ||
                          decryptedData?.details?.responseStatus?.code || 
                          decryptedData?.details?.code;

        // Look up mapped error details
        const mappedErrorDetails = errorCode ? errorMapping[errorCode] : null;

        // Set activeError with a more descriptive message including mapped details
        const errorMsg = data.error || data.details?.error || `Request failed with status ${data.status}.`;
        let detailedErrorMessage = errorMsg;
        if (errorCode) detailedErrorMessage += ` Error Code: ${errorCode}.`;
        if (mappedErrorDetails?.description) detailedErrorMessage += ` Description: ${mappedErrorDetails.description}`; // Add description from mapping
        
        setActiveError(detailedErrorMessage);
        
        // Set activeResponse with status, headers, and potentially formatted error data
        setActiveResponse({
          status: data.status,
          data: decryptedData, // Keep decrypted data for raw view
          headers: data.headers,
          mappedError: mappedErrorDetails, // Pass mapped details to ApiPanel
          errorCode: errorCode // Pass error code to ApiPanel
        });

      } else {
        const decryptedData = await decryptResponseData(data.data);
        setActiveResponse({
          status: data.status,
          data: decryptedData,
          headers: data.headers
        });
        setActiveError(null);
      }

    } catch (error) {
      console.error('Network or unexpected error:', error);
      setActiveError(error.message || 'An unexpected error occurred.');
      setActiveResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Day One Developer Program at Visa</h1>
        <div className="header-buttons">
          <button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            <FaCog /> Settings
          </button>
          <button
            className="collection-toggle"
            onClick={() => setShowCollection(!showCollection)}
          >
            <FaList /> Collection
          </button>
        </div>
      </header>

      <main className="App-main">
        {showSettings && (
          <SettingsPanel
            showSettings={showSettings}
            settingsSaved={settingsSaved}
            setSettingsSaved={setSettingsSaved}
            mleAvailable={mleAvailable}
            setMleAvailable={setMleAvailable}
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            setShowSettings={setShowSettings}
            selectedEnvironment={selectedEnvironment}
            setSelectedEnvironment={setSelectedEnvironment}
            environments={environments}
            authMethod={authMethod}
            setAuthMethod={setAuthMethod}
          />
        )}
        
        <div className="main-container">
          {showCollection && (
            <CollectionPanel
              showCollection={showCollection}
              onRequestSelect={handleRequestSelect}
              setError={setError}
            />
          )}
          
          <ApiPanel
            activeApiUrl={activeApiUrl}
            setActiveApiUrl={setActiveApiUrl}
            activeMethod={activeMethod}
            setActiveMethod={setActiveMethod}
            activePayload={activePayload}
            activeResponse={activeResponse}
            activeError={activeError}
            handleSendRequest={handleSendRequest}
            onPayloadChange={handlePayloadChange}
            loading={loading}
            settingsSaved={settingsSaved}
            authMethod={authMethod}
          />
        </div>
        {error && !activeError && (
           <div className="error-message">
             <h3>Error</h3>
             <pre>{error}</pre>
           </div>
        )}
      </main>
    </div>
  );
}

export default App;