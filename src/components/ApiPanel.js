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
  activeMethod,
  activePayload,
  activeResponse,
  activeError,
  onPayloadChange // Receive the new prop
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
              placeholder="Enter API URL"
              readOnly
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
              {activeResponse && activeResponse.status && (
                <span className={`status-badge status-${activeResponse.status}`}>
                  {activeResponse.status} {activeResponse.status >= 400 ? 'Error' : 'OK'}
                </span>
              )}
            </div>

            {activeResponse && activeResponse.status >= 400 ? (
              <div className="error-response-container">
                {activeResponse.errorCode && (
                  <div className="error-detail-item">
                    <span className="detail-label">Error Code:</span>
                    <span className="detail-value">{activeResponse.errorCode}</span>
                  </div>
                )}

                {activeResponse.mappedError?.description && (
                   <div className="error-detail-item">
                     <span className="detail-label">Description:</span>
                     <span className="detail-value">{activeResponse.mappedError.description}</span>
                   </div>
                )}

                {activeResponse.mappedError?.troubleshooting && (
                   <div className="error-detail-item">
                     <span className="detail-label">Troubleshooting:</span>
                     <span className="detail-value">{activeResponse.mappedError.troubleshooting}</span>
                   </div>
                )}

                {activeResponse.headers && activeResponse.headers['x-correlation-id'] && (
                   <div className="error-detail-item">
                     <span className="detail-label">CR-ID:</span>
                     <span className="detail-value">{activeResponse.headers['x-correlation-id']}</span>
                   </div>
                )}

                {activeResponse.data !== undefined && (
                   <div className="raw-error-data-section">
                     <h4>Raw Response Data</h4>
                     <pre className="error-raw-data">{JSON.stringify(activeResponse.data, null, 2) || 'No raw data'}</pre>
                   </div>
                )}

              </div>
            ) : (
              activeResponse && (
                <div className="response-container">
                  <div className="response-body">
                    <h4>Response Body</h4>
                    <pre className="response-data">
                      {JSON.stringify(activeResponse.data, null, 2) || 'No response data'}
                    </pre>
                  </div>
                  {activeResponse.headers && (
                    <div className="response-headers">
                      <div className="header-item">
                        <span className="header-name">CR-ID:</span>
                        <span className="header-value">{activeResponse.headers['x-correlation-id'] || 'Not available'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {!loading && !activeResponse && !activeError && (
              <div className="no-response">
                <p>Send a request to see the response.</p>
              </div>
            )}
            {loading && (
              <div className="loading-response">
                <p>Loading...</p>
              </div>
            )}
          </div>

        </div>

      </form>
    </div>
  );
};

export default ApiPanel; 