import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPaperPlane, FaCode, FaExchangeAlt } from 'react-icons/fa';
import ErrorDisplay from './ErrorDisplay';

const ApiTryOutPanel = ({
  apiUrl,
  setApiUrl,
  method,
  setMethod,
  payload,
  setPayload,
  loading,
  setLoading,
  response,
  setResponse,
  error,
  setError,
  settingsSaved,
  authMethod,
  settings,
  xpaySettings,
  // New props for dynamic form generation based on schema
  requestSchema,
  onPayloadChange,
  requestPayload,
  // Props to handle oneOf schemas
  schemaOptions,
  selectedSchemaKey,
  onSchemaSelect,
  renderSchemaFields // Pass down the recursive render function
}) => {

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResponse(null);

    if (!settingsSaved) {
      setError('Please save settings first');
      return;
    }

    if (!apiUrl) {
      setError('Please provide an API URL');
      return;
    }

    if (method === 'POST' && !payload) {
      setError('Please provide a JSON payload for POST requests');
      return;
    }

    try {
      setLoading(true);
      let payloadObj;
      if (method === 'POST') {
        try {
          // Use requestPayload state for sending, as it's managed by parent/form fields
          payloadObj = requestPayload;
        } catch (e) {
          // This catch might be less relevant now as payload state is an object
          console.error('Error processing payload:', e);
           // Fallback if requestPayload is somehow invalid, although unlikely with form state
           try {
             payloadObj = JSON.parse(payload); // Still keep parsing textarea payload as a fallback
           } catch (parseError) {
             throw new Error('Invalid JSON payload: ' + parseError.message);
           }
        }
      }

      // Determine which settings to send based on the selected authentication method
      const settingsToSend = authMethod === 'mutualAuth' ? settings : xpaySettings;

      const response = await fetch('http://localhost:3001/api/visa/transaction', {
        method: 'POST', // Note: Fetch method is always POST to our backend
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: method === 'POST' ? payloadObj : null,
          apiUrl,
          method, // Send the actual API method (GET/POST)
          settings: settingsToSend,
          authMethod,
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

      // Handle encrypted responses if necessary - this logic seems to be for decryption on the client side, might need review based on actual server capabilities
       let decryptedData = null;
       if (data && (data.encData || data.details?.encData)) {
           try {
               const encryptedPayload = data.encData || data.details.encData;
               const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                   encryptedData: encryptedPayload
                 })
               });

               if (decryptResponse.ok) {
                 const decryptData = await decryptResponse.json();
                 decryptedData = decryptData.decryptedData;
               } else {
                   console.error('Decryption failed on server side:', decryptResponse.status);
               }
           } catch (decryptError) {
               console.error('Failed to decrypt data:', decryptError);
           }
       }

      // Set response data based on status code and decryption result
      if (response.ok) {
        setResponse({
          status: data.status,
          data: decryptedData || data.data, // Prefer decrypted data if available
          headers: data.headers,
          isEncrypted: !!(data.encData || data.details?.encData) // Indicate if original data was encrypted
        });
      } else {
         // For error responses, display error details, possibly decrypted
        setResponse({
          status: data.status,
          data: decryptedData || data.details, // Prefer decrypted details if available
          error: data.error,
          errorCode: data.errorCode,
          errorMapping: data.errorMapping,
          isEncrypted: !!(data.encData || data.details?.encData) // Indicate if original data was encrypted
        });
        // Set error message for display
        let errorMessage = data.error || 'Request failed';
        if (decryptedData || data.details) {
             errorMessage += `\nDetails: ${JSON.stringify(decryptedData || data.details, null, 2)}`;
        }
        setError(errorMessage);
      }

    } catch (error) {
      console.error('Request failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine if we should render the dynamic form or a textarea
  const renderPayloadInput = () => {
      // If a request schema is provided (from SpecificationsPanel)
      if (requestSchema) {
          // Handle oneOf schemas - render select dropdown
          if (requestSchema.oneOf && schemaOptions) {
               // Determine the currently active schema based on selectedSchemaKey
               const activeSchema = selectedSchemaKey !== null ? requestSchema.oneOf[selectedSchemaKey] : null;
              return (
                <div className="schema-options">
                  <h4>Select Request Type</h4>
                  <select
                    onChange={onSchemaSelect}
                    className="schema-select"
                    value={selectedSchemaKey !== null ? selectedSchemaKey : ''}
                  >
                    <option value="">Select a request type</option>
                    {schemaOptions.map((option, index) => (
                      <option key={index} value={index}>
                        {option.title || option.$ref?.split('/').pop() || `Option ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  {activeSchema && (
                     // Render fields for the active schema, passing the requestPayload managed by parent
                    <div className="schema-fields">
                        {renderSchemaFields(activeSchema, requestPayload)}
                    </div>
                  )}
                   {!activeSchema && selectedSchemaKey === null && (
                       <div className="schema-fields">
                           <p>Please select a request type to view and edit the payload.</p>
                       </div>
                   )}
                </div>
              );
          } else if (requestSchema.properties) {
               // If it has properties, render fields directly, passing the requestPayload managed by parent
               return (
                  <div className="schema-fields">
                      {renderSchemaFields(requestSchema, requestPayload)}
                  </div>
               );
          } else {
              // Fallback for schemas without properties or oneOf
              return (
                 <div className="schema-fields">
                     <p>Schema provided, but no properties or oneOf found to generate form.</p>
                     {/* Optionally render raw JSON textarea for debugging */}
                 </div>
              );
          }
      } else if (method === 'POST') {
          // If no schema is provided (e.g., manual input or collection), render textarea
          return (
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = (e.target.scrollHeight) + 'px';
                }}
                rows="1"
                required={method === 'POST'}
                className="payload-textarea"
                placeholder="Enter your JSON payload here..."
              />
          );
      }
      return null; // No input needed for GET or if no schema/POST
  };

  return (
    <div className="api-panel">
      <form onSubmit={handleSubmit} className="api-form">
        <div className="request-bar">
          <div className="method-url-group">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`method-select is-${method.toLowerCase()}`}
              disabled={!!requestSchema} // Disable method select if schema is provided
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
              className="api-url-input"
              placeholder="Enter request URL"
              disabled={!!requestSchema} // Disable URL input if schema is provided
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
              <FaCode /> Request
            </div>
             {/* Render dynamic or textarea payload input */}
            {renderPayloadInput()}
          </div>

          <div className="response-section">
            <div className="section-header">
              <FaExchangeAlt /> Response
              {response && (
                <span className={`status-badge status-${response.status}`}>
                  {response.status} {response.status === 200 ? 'OK' : 'Error'}
                </span>
              )}
            </div>
            <div className="response-container">
              {response && (
                <div className="form-group payload-group">
                   {/* Display raw response data, prioritizing decrypted data if available */}
                   <pre className="response-data">
                     {JSON.stringify(response.data, null, 2) || 'No response data'}
                   </pre>
                </div>
              )}
               {!response && !loading && <p>Send a request to see the response.</p>}
               {loading && <p>Loading...</p>}
            </div>
          </div>

          {/* Error Display */}
          {(error || (response && response.status >= 400)) && (
            <ErrorDisplay
              error={error}
              response={{
                ...response,
                // Ensure data property is present for ErrorDisplay
                data: response?.data || response?.details,
                errorCode: response?.errorCode || response?.data?.responseStatus?.code,
                // Provide a default error mapping if none is available
                errorMapping: response?.errorMapping || {
                   description: response?.error || 'An unknown error occurred.',
                   troubleshooting: 'Please check the response data for more details or consult the API documentation.'
                }
              }}
            />
          )}

          {/* Correlation ID display */}
           {response?.headers && response.headers['x-correlation-id'] && (
            <div className="correlation-id">
              <strong>Correlation ID:</strong> {response.headers['x-correlation-id']}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ApiTryOutPanel; 