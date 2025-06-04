import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaList, FaUpload, FaTrash } from 'react-icons/fa';

const CollectionPanel = ({ showCollection, onRequestSelect, setError }) => {
  const [postmanCollection, setPostmanCollection] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Add file input reference
  const fileInputRef = useRef(null);

  // Add getMethodStyle function - Keep this for styling within the component
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

  // Add function to handle Postman collection upload
  const handlePostmanUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const collection = JSON.parse(e.target.result);
          setPostmanCollection(collection);
          // Need to handle potential error state display - maybe pass setError as prop?
          setError(null); // Clear previous errors on successful upload
          console.log('Postman collection loaded successfully!');

        } catch (error) {
           setError('Invalid Postman collection file');
           console.error('Invalid Postman collection file:', error);
           setPostmanCollection(null); // Clear the collection on error
        }
      };
      reader.readAsText(file);
    }
  };

  // Add function to handle request selection and pass up to parent
  const handleRequestSelect = (request) => {
    setSelectedRequest(request);
    // Call the prop function to update state in App.js
    if (onRequestSelect) {
       let payload = '';
       if (request.request.body && request.request.body.raw) {
         try {
            // Attempt to parse JSON, if fails, keep raw string
           payload = JSON.stringify(JSON.parse(request.request.body.raw), null, 2);
         } catch (error) {
           payload = request.request.body.raw;
         }
       }
      onRequestSelect({
        apiUrl: request.request.url.raw,
        method: request.request.method,
        payload: payload,
      });
    }
  };

  // Add function to handle collection removal
  const handleRemoveCollection = () => {
    setPostmanCollection(null);
    setSelectedRequest(null);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
     // Also clear the selected request data in the parent (App.js)
     if (onRequestSelect) {
       onRequestSelect({
         apiUrl: '',
         method: 'GET', // Reset to default method
         payload: '',
       });
     }
     setError(null); // Clear any collection-related errors
  };

  return (
      showCollection && (
          <motion.div 
            className="collection-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="collection-header">
              <h3>Collection</h3>
              <div className="collection-actions">
                <input
                  type="file"
                  accept=".json"
                  onChange={handlePostmanUpload}
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                />
                <button className="upload-button" onClick={() => fileInputRef.current?.click()}>
                  <FaUpload /> Upload Collection
                </button>
                {postmanCollection && (
                  <button 
                    className="remove-collection-btn" 
                    onClick={handleRemoveCollection}
                    title="Remove Collection"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>
            {postmanCollection ? (
              <div className="request-list">
                {postmanCollection.item.map((item, index) => (
                  <div
                    key={index}
                    className={`request-item ${selectedRequest === item ? 'selected' : ''}`}
                    onClick={() => handleRequestSelect(item)}
                  >
                    <span className="method-badge" style={getMethodStyle(item.request.method)}>
                      {item.request.method}
                    </span>
                    <span className="request-name">{item.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="upload-container">
                <FaUpload className="upload-icon" />
                <p>Upload a Postman collection to get started</p>
              </div>
            )}
          </motion.div>
      )
  );
};

export default CollectionPanel; 