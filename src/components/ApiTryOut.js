import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUpload, FaPlay, FaCode, FaExchangeAlt } from 'react-icons/fa';
import ErrorDisplay from './ErrorDisplay';

const ApiTryOut = ({ settingsSaved, settings }) => {
  const [apiSpec, setApiSpec] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [requestPayload, setRequestPayload] = useState({});
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSchemaKey, setSelectedSchemaKey] = useState(null); // To track selected schema index for oneOf

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const spec = JSON.parse(e.target.result);
          setApiSpec(spec);
          // Reset states when a new file is uploaded
          setSelectedEndpoint(null);
          setRequestPayload({});
          setResponse(null);
          setError(null);
          setSelectedSchemaKey(null); // Reset schema key
        } catch (error) {
          setError('Invalid JSON file. Please upload a valid Visa Direct API Reference JSON document.');
        }
      };
      reader.readAsText(file);
    } else {
        // If file upload is cancelled, clear everything
        setApiSpec(null);
        setSelectedEndpoint(null);
        setRequestPayload({});
        setResponse(null);
        setError(null);
        setSelectedSchemaKey(null);
    }
  };

  // Effect to reset selected schema when endpoint changes
  useEffect(() => {
    // Only reset if selectedEndpoint is null (e.g., file uploaded or endpoint deselected)
    if (!selectedEndpoint) {
        setSelectedSchemaKey(null);
    }
  }, [selectedEndpoint]);

  // Recursive function to generate form fields from a given schema part
  const renderSchemaFields = (schemaPart, currentPayload, parentKey = '') => {
    if (!schemaPart || typeof schemaPart !== 'object') return null;

    // Handle properties
    if (schemaPart.properties) {
      return Object.entries(schemaPart.properties).map(([key, value]) => {
        const fieldKey = parentKey ? `${parentKey}.${key}` : key;
        // Determine if required based on parent schema's required array
        const isRequired = schemaPart.required?.includes(key);
        const fieldValue = getNestedValue(currentPayload, fieldKey);

        if (value.type === 'object' && value.properties) {
          return (
            <div key={fieldKey} className="nested-field-group">
              <h4>{key}</h4>
              {renderSchemaFields(value, currentPayload, fieldKey)}
            </div>
          );
        }

        // Render input field based on type
        return (
          <div key={fieldKey} className="form-group">
            <label>
              {key}
              {isRequired && <span className="required">*</span>}
            </label>
            {value.type === 'string' && (
              <input
                type="text"
                value={fieldValue !== undefined ? fieldValue : ''}
                onChange={(e) => handlePayloadChange(fieldKey, e.target.value)}
                placeholder={value.description || `Enter ${key}`}
                required={isRequired}
              />
            )}
            {value.type === 'number' && (
              <input
                type="number"
                value={fieldValue !== undefined ? fieldValue : ''}
                onChange={(e) => handlePayloadChange(fieldKey, parseFloat(e.target.value))}
                placeholder={value.description || `Enter ${key}`}
                required={isRequired}
              />
            )}
            {value.type === 'boolean' && (
              <select
                value={fieldValue !== undefined ? (fieldValue ? 'true' : 'false') : ''}
                onChange={(e) => handlePayloadChange(fieldKey, e.target.value === 'true')}
                required={isRequired}
              >
                <option value="">Select</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            )}
            {/* Add other types as needed */}
            {value.description && (
              <small className="field-description">{value.description}</small>
            )}
          </div>
        );
      });
    }

     // If it's an array with items, render fields for a single item as a template
     if (schemaPart.type === 'array' && schemaPart.items) {
        // Note: This is a basic representation for arrays. Full array handling (add/remove items) would be more complex.
         return (
             <div key={parentKey} className="array-item-template">
                <h4>{parentKey || 'Array Item'}</h4>
                 {renderSchemaFields(schemaPart.items, currentPayload, parentKey)}
             </div>
         );
     }

    return null;
  };

   // Helper function to get nested value from an object using dot notation key
  const getNestedValue = (obj, key) => {
    return key.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

    // Helper function to set nested value in an object using dot notation key
  const setNestedValue = (obj, key, value) => {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    return obj;
  };

  const handlePayloadChange = (key, value) => {
    setRequestPayload(prev => {
        const newState = { ...prev };
        setNestedValue(newState, key, value);
        return newState;
    });
  };

  const handleEndpointSelect = (path, method, operation) => {
    setSelectedEndpoint({
      path,
      method,
      ...operation
    });

    // Attempt to find and set a default example payload
    const examples = operation.requestBody?.content?.['application/json']?.examples;
    let defaultPayload = {};
    let initialSchemaKey = null;

    if (examples) {
      // Prioritize examples that might match a oneOf schema title/summary
       for (const exampleKey in examples) {
           if (examples[exampleKey].value) {
                defaultPayload = examples[exampleKey].value;

                // If schema is oneOf, try to find which schema this example matches
                const schema = operation.requestBody?.content?.['application/json']?.schema;
                if (schema?.oneOf) {
                    const matchedIndex = schema.oneOf.findIndex(subSchema =>
                       // Simple check: see if example contains keys from this schema's properties
                       subSchema.properties && Object.keys(subSchema.properties).some(prop => defaultPayload.hasOwnProperty(prop))
                        // Add more sophisticated matching if needed, e.g., checking required fields or specific values
                    );
                    if (matchedIndex !== -1) {
                        initialSchemaKey = matchedIndex;
                        break; // Found a matching example, use this one
                    }
                }
                 // If not a oneOf or no schema match, use the first example found
                 if (initialSchemaKey === null) {
                    break; // Use the first example if no specific oneOf schema match is found yet
                 }
           }
       }
    }

     // If no example is found or matched to a oneOf schema, generate a basic payload structure from the schema
     const mainSchema = operation.requestBody?.content?.['application/json']?.schema;
     if (Object.keys(defaultPayload).length === 0 && mainSchema) {
        if (mainSchema.oneOf) {
            // If it's a oneOf and no example matched, default to the first schema and generate payload
             initialSchemaKey = 0;
            if (mainSchema.oneOf[initialSchemaKey]) {
                 defaultPayload = generateEmptyPayload(mainSchema.oneOf[initialSchemaKey]);
            }
        } else {
             // If not oneOf, generate empty payload for the main schema
             defaultPayload = generateEmptyPayload(mainSchema);
        }
     }

    setRequestPayload(defaultPayload);
    setResponse(null);
    setError(null);
    setSelectedSchemaKey(initialSchemaKey); // Set the initial schema key
  };

  // Helper to generate an empty payload structure based on schema
  const generateEmptyPayload = (schema) => {
      if (!schema || typeof schema !== 'object') return {};

      // If it's a oneOf, return empty for now. User needs to select.
      // Note: This case should be handled before calling generateEmptyPayload for oneOf.
      if (schema.oneOf) {
          return {};
      }

      // If it has properties, build the structure recursively
      if (schema.properties) {
          const payload = {};
          Object.entries(schema.properties).forEach(([key, value]) => {
              if (value.type === 'object' && value.properties) {
                  payload[key] = generateEmptyPayload(value);
              } else if (value.type === 'array' && value.items) {
                   // For arrays, add an empty array, not a template object
                  payload[key] = [];
              }else {
                  // Set empty string or default value for primitives
                  payload[key] = value.default !== undefined ? value.default : '';
              }
          });
          return payload;
      }

      return {}; // Return empty object for other schema types or if no properties/oneOf
  }

  const handleSchemaSelect = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const schema = selectedEndpoint.requestBody?.content?.['application/json']?.schema;

    if (schema?.oneOf && schema.oneOf[selectedIndex]) {
      const selectedSchema = schema.oneOf[selectedIndex];
      // Generate empty payload for the newly selected sub-schema
      const newPayload = generateEmptyPayload(selectedSchema);
      setRequestPayload(newPayload);
      setSelectedSchemaKey(selectedIndex); // Update selected schema key
    } else {
        setRequestPayload({}); // Clear payload if no valid schema selected
        setSelectedSchemaKey(null);
    }
  };

  // Function to render the form based on the selected endpoint's schema and selected sub-schema (if oneOf)
  const renderRequestForm = () => {
    const schema = selectedEndpoint.requestBody?.content?.['application/json']?.schema;

    if (!schema) return null;

    // If it's a oneOf schema, render the select first and then the fields for the active schema
    if (schema.oneOf) {
      // Determine the currently active schema based on selectedSchemaKey
      const activeSchema = selectedSchemaKey !== null ? schema.oneOf[selectedSchemaKey] : null;

      return (
        <div className="request-form">
          <h4>Request Payload</h4>
          <div className="schema-options">
            <h4>Select Request Type</h4>
            <select
              onChange={handleSchemaSelect}
              className="schema-select"
              value={selectedSchemaKey !== null ? selectedSchemaKey : ''}
            >
              <option value="">Select a request type</option>
              {schema.oneOf.map((option, index) => (
                <option key={index} value={index}>
                  {option.title || option.$ref?.split('/').pop() || `Option ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
          {activeSchema && (
             // Render fields for the active schema, passing the current requestPayload
            <div className="schema-fields">
                {renderSchemaFields(activeSchema, requestPayload)}
            </div>
          )}
           {!activeSchema && selectedSchemaKey === null && (
               <div className="schema-fields">
                   <p>Please select a request type to view and edit the payload.</p>
               </div>
           )}
          <form onSubmit={(e) => { e.preventDefault(); handleTryIt(); }}>
            <motion.button
              type="submit"
              disabled={loading || !settingsSaved || (schema.oneOf && selectedSchemaKey === null)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="try-button"
            >
              {loading ? 'Sending...' : <><FaPlay /> Try It</>}
            </motion.button>
          </form>
        </div>
      );
    }

    // If not oneOf, just render the fields directly
    return (
      <div className="request-form">
        <h4>Request Payload</h4>
        <form onSubmit={(e) => { e.preventDefault(); handleTryIt(); }}>
          {renderSchemaFields(schema, requestPayload)}
          <motion.button
            type="submit"
            disabled={loading || !settingsSaved}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="try-button"
          >
            {loading ? 'Sending...' : <><FaPlay /> Try It</>}
          </motion.button>
        </form>
      </div>
    );
  };

  const handleTryIt = async () => {
    if (!settingsSaved) {
      setError('Please save settings first');
      return;
    }

    // For oneOf schemas, ensure a schema type is selected before trying to send
    const schema = selectedEndpoint?.requestBody?.content?.['application/json']?.schema;
    if (schema?.oneOf && selectedSchemaKey === null) {
        setError('Please select a request type before sending.');
        return;
    }

    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      // Get the base URL from the API spec
      const baseUrl = apiSpec?.servers?.[0]?.url || 'https://sandbox.api.visa.com';
      const fullUrl = `${baseUrl}${selectedEndpoint.path}`;

      // Only include payload for POST requests
      const requestBody = selectedEndpoint.method === 'POST' ? requestPayload : null;

      const response = await fetch('http://localhost:3001/api/visa/transaction', {
        method: 'POST', // Note: Fetch method is always POST to our backend
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: requestBody, // Use the requestBody determined above
          apiUrl: fullUrl,
          method: selectedEndpoint.method, // Send the actual API method (GET/POST)
          settings
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResponse({
          status: data.status,
          data: data.data,
          headers: data.headers,
          isEncrypted: data.isEncrypted
        });
      } else {
        setResponse({
          status: data.status,
          data: data.details,
          error: data.error,
          errorCode: data.errorCode,
          errorMapping: data.errorMapping
        });
        setError(data.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-try-out">
      <div className="upload-section">
        <div className="upload-box">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            id="api-spec-upload"
            className="file-input"
          />
          <label htmlFor="api-spec-upload" className="upload-label">
            <FaUpload /> Upload Visa Direct API Reference JSON
          </label>
        </div>
      </div>

      {apiSpec && (
        <div className="endpoints-section">
          <h3>Available Endpoints</h3>
          <div className="endpoints-list">
            {/* Check if apiSpec.paths exists before mapping */}
            {Object.entries(apiSpec.paths || {}).map(([path, methods]) => (
              Object.entries(methods).map(([method, operation]) => (
                <div
                  key={`${method}-${path}`}
                  className={`endpoint-item ${selectedEndpoint?.path === path && selectedEndpoint?.method === method.toLowerCase() ? 'selected' : ''}`}
                  onClick={() => handleEndpointSelect(path, method, operation)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`method-badge method-${method.toLowerCase()}`}>
                    {method.toUpperCase()}
                  </span>
                  <span className="endpoint-path">{path}</span>
                </div>
              ))
            ))}
          </div>
        </div>
      )}

      {selectedEndpoint && (
        <div className="try-out-section">
          <div className="endpoint-details">
            <h3>
              <span className={`method-badge method-${selectedEndpoint.method.toLowerCase()}`}>
                {selectedEndpoint.method.toUpperCase()}
              </span>
              {selectedEndpoint.path}
            </h3>
            {selectedEndpoint.description && (
              <p className="endpoint-description">{selectedEndpoint.description}</p>
            )}
          </div>

          {/* Render the request form using the new function */}
          {selectedEndpoint.method === 'POST' && renderRequestForm()}

          {selectedEndpoint.method === 'GET' && (
            <div className="request-form">
              <motion.button
                onClick={handleTryIt}
                disabled={loading || !settingsSaved}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="try-button"
              >
                {loading ? 'Sending...' : <><FaPlay /> Try It</>}
              </motion.button>
            </div>
          )}

          {response && (
            <div className="response-section">
              <div className="section-header">
                <FaExchangeAlt /> Response
                <span className={`status-badge status-${response.status}`}>
                  {response.status} {response.status === 200 ? 'OK' : 'Error'}
                </span>
              </div>
              <div className="response-container">
                {/* Display raw response data if decrypted data is not available or if it was an error */}
                <pre className="response-data">
                  {JSON.stringify(response.decryptedData || response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error Display */}
          {(error || (response && response.status >= 400)) && (
            <ErrorDisplay
              error={error}
              response={{
                ...response,
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

          {/* Moved correlation ID display here to be part of the response section when available */}
           {response?.headers && response.headers['x-correlation-id'] && (
            <div className="correlation-id">
              <strong>Correlation ID:</strong> {response.headers['x-correlation-id']}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ApiTryOut; 