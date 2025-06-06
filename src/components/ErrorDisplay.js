import React from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaLightbulb, FaCode, FaExchangeAlt } from 'react-icons/fa';

const ErrorDisplay = ({ error, response }) => {
  if (!error && (!response || response.status < 400)) return null;

  // Extract error details from response if available
  const errorCode = response?.data?.responseStatus?.code || 
                   response?.errorCode || 
                   response?.data?.code ||
                   response?.details?.responseStatus?.code || // Also check in details field
                   response?.details?.code;

  // Get error details from mapping if available
  // Prioritize mappedError from response if present, otherwise use the default generic one
  const mappedError = response?.errorMapping || {
    description: response?.details?.error || response?.error || 'No specific error description available',
    troubleshooting: 'Please check your request parameters and try again.'
  };

  console.log('Error Display - Response:', response);
  console.log('Error Display - Error Code:', errorCode);
  console.log('Error Display - Mapped Error:', mappedError);
  console.log('Error Display - Response Error Mapping:', response?.errorMapping);

  return (
    <div className="error-display">
      <div className="error-header">
        <FaExclamationTriangle className="error-icon" />
        <span>Error Details</span>
      </div>
      <div className="error-content">
        {/* Display the primary error message */}
        {error && <p className="main-error-message">{error}</p>}

        {errorCode && (
          <div className="error-details">
            <div className="error-code">
              <strong>Error Code:</strong> {errorCode}
            </div>
            {/* Display mapped error details if available */}
            {(mappedError.description || mappedError.troubleshooting) && (
               <div className="error-description">
                 {mappedError.description && (
                   <div className="error-section">
                     <FaInfoCircle className="section-icon" />
                     <div>
                       <strong>Description:</strong>
                       <p>{mappedError.description}</p>
                     </div>
                   </div>
                 )}
                 {mappedError.troubleshooting && (
                   <div className="error-section">
                     <FaLightbulb className="section-icon" />
                     <div>
                       <strong>Troubleshooting:</strong>
                       <p>{mappedError.troubleshooting}</p>
                     </div>
                   </div>
                 )}
               </div>
            )}
          </div>
        )}

        {/* Display raw error response data if available */}
        {response?.data && ( 
          <div className="error-section">
             <FaCode className="section-icon" />
             <div>
               <strong>Raw Error Response Data:</strong>
               <pre className="error-raw-data">{JSON.stringify(response.data, null, 2)}</pre>
             </div>
          </div>
        )}

        {/* Display response headers if available (includes correlation ID)*/}
        {response?.headers && ( 
           <div className="error-section">
              <FaExchangeAlt className="section-icon" />
              <div>
                <strong>Response Headers:</strong>
                <pre className="error-headers">{JSON.stringify(response.headers, null, 2)}</pre>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default ErrorDisplay; 