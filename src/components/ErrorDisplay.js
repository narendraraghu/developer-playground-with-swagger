import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

const ErrorDisplay = ({ error, response }) => {
  if (!error) return null;

  return (
    <div className="error-display">
      <div className="error-header">
        <FaExclamationTriangle className="error-icon" />
        <span>Error</span>
      </div>
      <div className="error-content">
        <pre>{error}</pre>
        {response && response.errorCode && (
          <div className="error-details">
            <p><strong>Error Code:</strong> {response.errorCode}</p>
            {response.errorMapping && (
              <p><strong>Error Mapping:</strong> {response.errorMapping}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay; 