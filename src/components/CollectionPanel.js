import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaList, FaUpload, FaTrash } from 'react-icons/fa';
import '../styles/CollectionPanel.css';

const CollectionPanel = ({ showCollection, onRequestSelect, setError }) => {
  const [postmanCollection, setPostmanCollection] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [specifications, setSpecifications] = useState([]);
  const [activeTab, setActiveTab] = useState('collections');

  const fileInputRef = useRef(null);
  const specFileInputRef = useRef(null);

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

  const handlePostmanUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const collection = JSON.parse(e.target.result);
          if (collection && Array.isArray(collection.item)) {
             setPostmanCollection(collection);
             setError(null);
             console.log('Postman collection loaded successfully!');
          } else {
             setError('Invalid Postman collection file format.');
             setPostmanCollection(null);
             console.error('Invalid Postman collection file format.');
          }
        } catch (error) {
          setError('Error parsing Postman collection file.');
          console.error('Error parsing Postman collection file:', error);
          setPostmanCollection(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSpecificationUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target.result);
        if (content && content.paths) {
            const endpoints = [];
            Object.entries(content.paths).forEach(([path, methods]) => {
              Object.entries(methods).forEach(([method, details]) => {
                if (method.toLowerCase() !== 'parameters') {
                  
                  console.log('Processing specification method:', method, 'for path:', path, 'Details:', details);

                  let requestBody = null;

                  // Only try to get/generate body for POST methods
                  if (method.toUpperCase() === 'POST') {
                    const requestBodyContent = details.requestBody?.content?.['application/json'];

                    // Check for examples object first
                    if (requestBodyContent?.examples) {
                      const exampleKeys = Object.keys(requestBodyContent.examples);
                      if (exampleKeys.length > 0) {
                        // Use the value of the first example found
                        requestBody = requestBodyContent.examples[exampleKeys[0]].value;
                      }
                    } else if (requestBodyContent?.example) {
                      // Fallback to direct example if examples object is not present
                      requestBody = requestBodyContent.example;
                    } else if (requestBodyContent?.schema?.properties) {
                      // Attempt to generate body from schema properties if no example
                      try {
                        const generatedBody = {};
                        const properties = requestBodyContent.schema.properties;
                        for (const prop in properties) {
                          const propType = properties[prop].type;
                          // Basic placeholder generation based on type
                          switch (propType) {
                            case 'string':
                              generatedBody[prop] = '<string>';
                              break;
                            case 'integer':
                            case 'number':
                              generatedBody[prop] = 0;
                              break;
                            case 'boolean':
                              generatedBody[prop] = false;
                              break;
                            case 'object':
                              generatedBody[prop] = {}; // Placeholder for nested objects
                              break;
                            case 'array':
                              generatedBody[prop] = []; // Placeholder for arrays
                              break;
                            default:
                              generatedBody[prop] = null; // Default placeholder
                          }
                        }
                        requestBody = JSON.stringify(generatedBody, null, 2); // Stringify for the text area
                      } catch (generateError) {
                        console.error('Error generating body from schema:', generateError);
                        requestBody = null; // Fallback to null if generation fails
                      }
                    }

                    // Ensure the body is a string if it's an object (from examples)
                    if (requestBody !== null && typeof requestBody === 'object') {
                      requestBody = JSON.stringify(requestBody, null, 2);
                    }

                  }

                  endpoints.push({
                    name: details.summary || `${method.toUpperCase()} ${path}`,
                    request: {
                      method: method.toUpperCase(),
                      url: path,
                      body: requestBody
                    }
                  });
                }
              });
            });
            setSpecifications(endpoints);
            setError(null);
            console.log('Specification file loaded successfully!');
        } else {
            setError('Invalid specification file format. Expected OpenAPI/Swagger format.');
            setSpecifications([]);
            console.error('Invalid specification file format.');
        }
      } catch (error) {
        console.error('Error parsing specification file:', error);
        setError('Error parsing specification file.');
        setSpecifications([]);
      }
    };
    reader.readAsText(file);
  };

  const handleRequestClick = (item, source) => {
    setSelectedRequest(item);
    
    let url = '';
    let method = 'GET';
    let body = null;

    if (source === 'collection' && item.request) {
      const postmanRequest = item.request;
      
      // Explicitly get the method from the postman request
      method = postmanRequest.method || 'GET';

      if (typeof postmanRequest.url?.raw === 'string') {
          url = postmanRequest.url.raw;
      } else if (typeof postmanRequest.url === 'object' && postmanRequest.url !== null) {
           try {
               const u = postmanRequest.url;
               const protocol = u.protocol || 'http';
               const host = Array.isArray(u.host) ? u.host.join('.') : u.host || '';
               const path = Array.isArray(u.path) ? '/' + u.path.join('/') : u.path || '';
               url = `${protocol}://${host}${path}`; 
               if (Array.isArray(u.query) && u.query.length > 0) {
                   const queryString = u.query.map(q => `${q.key}=${q.value}`).join('&');
                   url += `?${queryString}`;
               }
           } catch (e) {
               console.error('Error constructing URL from Postman object:', e);
               url = '';
           }
       } else if (typeof postmanRequest.url === 'string') {
           url = postmanRequest.url;
       }

      if (postmanRequest.body && typeof postmanRequest.body.raw === 'string') {
          body = postmanRequest.body.raw;
      } else {
          body = null;
      }

    } else if (source === 'specification' && item.request) {
       const specRequest = item.request;
       url = specRequest.url || '';
       method = specRequest.method || 'GET';
       body = specRequest.body !== undefined ? specRequest.body : null;
    }

    onRequestSelect({
        url: url,
        method: method,
        body: body,
    });
    console.log('CollectionPanel sending method:', method);
    console.log('CollectionPanel sending body:', body);
  };

  const handleRemoveData = () => {
    // Clear collection data
    setPostmanCollection(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }

    // Clear specification data
    setSpecifications([]);
     if (specFileInputRef.current) {
      specFileInputRef.current.value = ''; // Clear file input
    }

    // Reset selected request and API panel
    setSelectedRequest(null);
    if (onRequestSelect) {
      onRequestSelect({
        url: '',
        method: 'GET',
        body: null,
      });
    }
    setError(null);
  };

  return (
    showCollection && (
      <motion.div 
        className="collection-panel"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: showCollection ? 1 : 0, x: showCollection ? 0 : -20 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        <div className="collection-header">
          <h3></h3>
          <div className="collection-actions">
            <input
              type="file"
              accept=".json"
              onChange={handlePostmanUpload}
              style={{ display: 'none' }}
              id="collection-upload"
              ref={fileInputRef}
            />
            <label htmlFor="collection-upload" className="upload-button">
              <FaUpload /> Collection
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleSpecificationUpload}
              style={{ display: 'none' }}
              id="specification-upload"
              ref={specFileInputRef}
            />
            <label htmlFor="specification-upload" className="upload-button">
              <FaUpload /> Specification
            </label>
            <button className="remove-collection-btn" onClick={handleRemoveData}>
              <FaTrash size={24} />
            </button>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            Collections
          </button>
          <button
            className={`tab-button ${activeTab === 'specifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('specifications')}
          >
            Specifications
          </button>
        </div>

        <div className="content-section">
          {activeTab === 'collections' ? (
            postmanCollection ? (
              <ul className="request-list">
                {postmanCollection.item.map((item, index) => (
                  <li
                    key={index}
                    className={`request-item ${selectedRequest === item ? 'selected' : ''}`}
                    onClick={() => handleRequestClick(item, 'collection')}
                  >
                    <span 
                      className="method-badge" 
                      data-method={item.request.method}
                    >
                      {item.request.method}
                    </span>
                    <span className="request-name">{item.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="upload-container">
                <FaUpload className="upload-icon" />
                <p>Upload a Postman collection to get started</p>
              </div>
            )
          ) : (
            specifications.length > 0 ? (
              <ul className="request-list">
                {specifications.map((spec, index) => (
                  <li
                    key={index}
                    className={`request-item ${selectedRequest === spec ? 'selected' : ''}`}
                    onClick={() => handleRequestClick(spec, 'specification')}
                  >
                    <span 
                      className="method-badge" 
                      data-method={spec.request.method}
                    >
                      {spec.request.method}
                    </span>
                    <span className="request-name">{spec.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="upload-container">
                 <FaUpload className="upload-icon" />
                 <p>Upload a specification file (OpenAPI/Swagger) to get started</p>
               </div>
            )
          )}
        </div>
      </motion.div>
    )
  );
};

export default CollectionPanel;