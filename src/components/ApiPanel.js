import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPaperPlane, FaCode, FaExchangeAlt } from 'react-icons/fa';
import DetailedErrorDisplay from './DetailedErrorDisplay';
import errorMapping from '../data/error-mapping.json';

const ApiPanel = ({
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
  responseHeaders,
  setResponseHeaders,
  error,
  setError,
  settingsSaved,
  authMethod,
  settings,
  xpaySettings,
}) => {
  // Add console logs to track error state
  useEffect(() => {
    console.log('Current Error State:', error);
    console.log('Current Response State:', response);
  }, [error, response]);

  const [defaultPayload] = useState({
    "amount": 124.05,
    "senderAddress": "901 Metro Center Blvd",
    "localTransactionDateTime": "2025-06-04T12:00:00",
    "pointOfServiceData": {
      "panEntryMode": 90,
      "posConditionCode": "00",
      "motoECIIndicator": 0
    },
    "recipientPrimaryAccountNumber": "4060320000000127",
    "colombiaNationalServiceData": {
      "addValueTaxReturn": 10,
      "taxAmountConsumption": 10,
      "nationalNetReimbursementFeeBaseAmount": 20,
      "addValueTaxAmount": 10,
      "nationalNetMiscAmount": 10,
      "countryCodeNationalService": 170,
      "nationalChargebackReason": 11,
      "emvTransactionIndicator": "1",
      "nationalNetMiscAmountType": "A",
      "costTransactionIndicator": "0",
      "nationalReimbursementFee": 20
    },
    "cardAcceptor": {
      "address": {
        "country": "USA",
        "zipCode": "94404",
        "county": "San Mateo",
        "state": "CA"
      },
      "idCode": "CA-IDCode-77765",
      "name": "Visa Inc. USA-Foster City",
      "terminalId": "TID-9999"
    },
    "senderReference": "",
    "transactionIdentifier": 883916196354773,
    "acquirerCountryCode": 840,
    "acquiringBin": 408999,
    "retrievalReferenceNumber": "412770452025",
    "senderCity": "Foster City",
    "senderStateCode": "CA",
    "systemsTraceAuditNumber": 451018,
    "senderName": "Mohammed Qasim",
    "businessApplicationId": "AA",
    "settlementServiceIndicator": 9,
    "merchantCategoryCode": 6012,
    "transactionCurrencyCode": "USD",
    "recipientName": "rohan",
    "senderCountryCode": "124",
    "sourceOfFundsCode": "05",
    "senderAccountNumber": "4060320000000126"
  });

  const getMethodStyle = (method) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return {
          backgroundColor: '#E8F5E9',
          color: '#2E7D32'
        };
      case 'POST':
        return {
          backgroundColor: '#FFF3E0',
          color: '#E65100'
        };
      case 'PUT':
        return {
          backgroundColor: '#E3F2FD',
          color: '#1565C0'
        };
      case 'DELETE':
        return {
          backgroundColor: '#FFEBEE',
          color: '#C62828'
        };
      default:
        return {
          backgroundColor: '#E8F5E9',
          color: '#2E7D32'
        };
    }
  };

  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    // Optionally clear payload and apiUrl when method changes
    // setPayload('');
    // setApiUrl('');
    if (newMethod === 'POST') {
      setApiUrl('https://sandbox.api.visa.com/visadirect/fundstransfer/v1/pushfundstransactions');
      setPayload(JSON.stringify(defaultPayload, null, 2));
    } else {
      setApiUrl('https://sandbox.api.visa.com/vdp/helloworld');
      setPayload('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResponse(null);
    setResponseHeaders(null);

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
          payloadObj = JSON.parse(payload);
        } catch (e) {
          throw new Error('Invalid JSON payload: ' + e.message);
        }
      }

      const settingsToSend = authMethod === 'mutualAuth' ? settings : xpaySettings;

      const response = await fetch('http://localhost:3001/api/visa/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: method === 'POST' ? payloadObj : null,
          apiUrl,
          method,
          settings: settingsToSend,
          authMethod,
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('=== Client Response Data ===');
        console.log('Full Response:', data);
        console.log('Response Status:', data.status);
        console.log('Response Data:', data.data);
        console.log('Decrypted Data:', data.decryptedData);
        console.log('Response Headers:', data.headers);
        console.log('========================');
      } else {
        const text = await response.text();
        console.error('Non-JSON Response:', text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
      }

      if (response.ok) {
        let decryptedData = null;
        if (data.data && data.data.encData) {
          try {
            const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                encryptedData: data.data.encData
              })
            });

            if (decryptResponse.ok) {
              const decryptData = await decryptResponse.json();
              decryptedData = decryptData.decryptedData;
              console.log('Decrypted Success Response:', decryptedData);
            }
          } catch (decryptError) {
            console.error('Failed to decrypt success response:', decryptError);
          }
        }

        setResponse({
          data: data.data,
          decryptedData: decryptedData,
          isEncrypted: !!data.data?.encData,
          status: data.status
        });
        setResponseHeaders(data.headers);
      } else {
        let decryptedDetails = null;
        if (data.details && data.details.encData) {
          try {
            const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                encryptedData: data.details.encData
              })
            });

            if (decryptResponse.ok) {
              const decryptData = await decryptResponse.json();
              decryptedDetails = decryptData.decryptedData;
              console.log('Decrypted Error Details:', decryptedDetails);
            }
          } catch (decryptError) {
            console.error('Failed to decrypt details:', decryptError);
          }
        }

        // Extract error information from response data
        const responseData = data.data || {};
        const responseStatus = responseData.responseStatus || {};
        const errorCode = responseStatus.errorCode || data.errorCode || 'UNKNOWN';
        const errorMessage = responseStatus.message || data.error || 'Request failed';
        
        console.log('Extracted Error Info:', {
          errorCode,
          errorMessage,
          responseStatus,
          responseData
        });
        
        // Set response with error details
        const errorResponse = {
          data: responseData,
          decryptedData: decryptedDetails,
          isEncrypted: !!data.details?.encData,
          status: data.status || response.status,
          error: errorMessage,
          errorCode: errorCode,
          errorMapping: errorMapping[errorCode]
        };
        console.log('Setting Error Response:', errorResponse);
        setResponse(errorResponse);
        setResponseHeaders(data.headers);

        // Set error message
        let formattedErrorMessage = '';
        if (decryptedDetails) {
          formattedErrorMessage = `Error: ${errorMessage}\nDetails: ${JSON.stringify(decryptedDetails, null, 2)}`;
        } else if (responseStatus) {
          formattedErrorMessage = `Error: ${errorMessage}\nDetails: ${JSON.stringify(responseStatus, null, 2)}`;
        } else if (responseData) {
          formattedErrorMessage = `Error: ${errorMessage}\nDetails: ${JSON.stringify(responseData, null, 2)}`;
        } else {
          formattedErrorMessage = errorMessage;
        }
        console.log('Setting Error Message:', formattedErrorMessage);
        setError(formattedErrorMessage);
      }
    } catch (error) {
      console.error('Request failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-container">
      <form onSubmit={handleSubmit} className="api-form">
        <div className="request-bar">
          <div className="method-url-group">
            <select
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              className={`method-select is-${method.toLowerCase()}`}
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
            {method === 'POST' && (
              <div className="form-group payload-group">
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight) + 'px';
                  }}
                  rows="1"
                  required
                  className="payload-textarea"
                  placeholder="Enter your JSON payload here..."
                />
              </div>
            )}
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
                  <textarea
                    value={
                      response.decryptedData
                        ? JSON.stringify(response.decryptedData, null, 2)
                        : response.data && response.data.encData
                          ? `Encrypted Response: ${JSON.stringify(response.data, null, 2)}`
                          : response.data
                            ? JSON.stringify(response.data, null, 2)
                            : 'No response data'
                    }
                    readOnly
                    className="payload-textarea"
                    style={{
                      minHeight: '200px',
                      backgroundColor: response.status >= 400 ? '#fff3f3' : '#f8f9fa',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      padding: '12px',
                      borderRadius: '4px',
                      border: response.status >= 400 ? '1px solid #ffcdd2' : '1px solid #dee2e6',
                      color: response.status >= 400 ? '#d32f2f' : 'inherit'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Detailed Error Display */}
          {response && response.status >= 400 && (
            <div className="error-display-container">
              <DetailedErrorDisplay
                error={error} 
                response={response} 
                errorMapping={errorMapping}
              />
            </div>
          )}

          {responseHeaders && responseHeaders['x-correlation-id'] && (
            <div className="correlation-id">
              <strong>Correlation ID:</strong> {responseHeaders['x-correlation-id']}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ApiPanel; 