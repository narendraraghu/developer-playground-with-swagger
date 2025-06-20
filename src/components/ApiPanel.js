import React from 'react';
import '../styles/ApiPanel.css';
import { motion } from 'framer-motion';
import { FaPaperPlane, FaCode, FaExchangeAlt } from 'react-icons/fa';
import ErrorDisplay from './ErrorDisplay';

// This component renders the main API request form and response display.
// It uses the centralized state and send handler passed from App.js.
const ApiPanel = ({
  loading,
  handleSendRequest, // Use the centralized send handler from App.js
  settingsSaved,
  activeApiUrl,
  setActiveApiUrl,
  activeMethod,
  setActiveMethod,
  activePayload,
  activeResponse,
  activeError,
  onPayloadChange, // Receive the new prop
  authMethod
}) => {

  console.log('ApiPanel activeMethod:', activeMethod);

  // The handleSubmit in ApiPanel now just calls the centralized handleSendRequest
  const handleSubmit = (event) => {
    event.preventDefault();
    // Call the centralized handler with the current form values
    handleSendRequest(activeApiUrl, activeMethod, activePayload);
  };

  return (
    <div className="api-container">
      <form onSubmit={handleSubmit} className="api-form">
        <div className="request-bar">
          <div className="method-url-group">
            <select
              className={`method-select is-${activeMethod.toLowerCase()}`}
              value={activeMethod}
              onChange={(e) => setActiveMethod(e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input
              type="text"
              className="api-url-input"
              value={activeApiUrl}
              onChange={(e) => setActiveApiUrl(e.target.value)}
              placeholder="Enter API URL"
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading || !settingsSaved}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="send-button"
          >
            {loading ? 'Sending...' : <><FaPaperPlane /> Send</>}
          </motion.button>
        </div>

        <div className="request-response-container">
          <div className="request-section">
            <div className="section-header">
              <FaCode /> Request Payload
            </div>
            <div className="api-section">
              <h3>Request Payload</h3>
              {activeMethod !== 'GET' ? (
                <textarea
                  className="payload-textarea"
                  value={activePayload}
                  placeholder="Enter JSON payload"
                  onChange={(e) => onPayloadChange(e.target.value)}
                  rows={10}
                />
              ) : (
                <div className="no-payload-message">
                  GET requests do not have a request body
                </div>
              )}
            </div>
          </div>

          <div className="response-section">
            <div className="section-header">
              <FaExchangeAlt /> Response
              {activeResponse && (
                <span className={`status-badge status-${activeResponse.status}`}>
                  {activeResponse.status} {activeResponse.status === 200 ? 'OK' : 'Error'}
                </span>
              )}
            </div>
            <div className="api-section">
              {activeError ? (
                <ErrorDisplay 
                  error={activeError} 
                  response={activeResponse}
                  authMethod={authMethod}
                />
              ) : activeResponse ? (
                <div className="response-container">
                  <pre className="response-data">
                    {JSON.stringify(activeResponse.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="no-response-message">
                  No response yet. Send a request to see the response.
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ApiPanel; 