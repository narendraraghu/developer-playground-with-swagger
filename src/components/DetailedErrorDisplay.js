import React, { useEffect } from 'react';
import { FaExclamationTriangle, FaQuestionCircle, FaBug } from 'react-icons/fa';

const DetailedErrorDisplay = ({ error, response, errorMapping }) => {
  useEffect(() => {
    console.log('DetailedErrorDisplay Props:', {
      error,
      response,
      errorMapping
    });
  }, [error, response, errorMapping]);

  // Check if there's a response with an error status (400 or higher)
  if (!response || response.status < 400) {
    console.log('No error response to display');
    return null;
  }

  // Extract error code from response
  const errorCode = response?.errorCode || (response?.data?.responseStatus?.errorCode) || (response?.data?.errorCode) || 'UNKNOWN';
  console.log('Extracted Error Code:', errorCode);

  // Get error details from mapping
  const errorDetails = errorMapping?.[errorCode];
  console.log('Error Details from Mapping:', errorDetails);

  // Extract error message from response
  const errorMessage = response?.error || (response?.data?.responseStatus?.message) || (response?.data?.message) || 'Request failed';

  return (
    <div className="detailed-error-display">
      <div className="error-header">
        <FaExclamationTriangle className="error-icon" />
        <span>Error Details</span>
      </div>
      
      <div className="error-content">
        {/* Error Code Section */}
        <div className="error-section">
          <h4>Error Code</h4>
          <div className="error-code">{errorCode}</div>
        </div>

        {/* Description Section */}
        <div className="error-section">
          <h4>Description</h4>
          <div className="error-description">
            {errorDetails?.description || 'No detailed description available for this error code.'}
          </div>
        </div>

        {/* Troubleshooting Section */}
        {errorDetails?.troubleshooting && (
          <div className="error-section">
            <h4>Troubleshooting Steps</h4>
            <div className="error-troubleshooting">
              {errorDetails.troubleshooting}
            </div>
          </div>
        )}

        {/* Raw Error Message */}
        <div className="error-section">
          <h4>Raw Error Message</h4>
          <pre className="raw-error">{errorMessage}</pre>
        </div>

        {/* Report Unknown Error Button */}
        {!errorDetails && (
          <div className="report-error-section">
            <button 
              className="report-error-button"
              onClick={() => window.open('https://github.com/your-repo/issues/new', '_blank')}
            >
              <FaBug /> Report Unknown Error
            </button>
          </div>
        )}

        {/* Help Section */}
        <div className="help-section">
          <FaQuestionCircle className="help-icon" />
          <span>Need more help? Check our documentation or contact support.</span>
        </div>
      </div>
    </div>
  );
};

export default DetailedErrorDisplay; 