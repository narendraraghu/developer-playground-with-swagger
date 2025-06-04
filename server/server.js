const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { createPublicKey, createPrivateKey } = require('crypto');

// Try to load jose module, but don't fail if it's not available
let jose;
try {
  jose = require('jose');
} catch (error) {
  console.log('jose module not available - MLE will be disabled');
}

const app = express();

// Security middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase payload size limit for larger requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../build')));

// Constants
const CERT_DIR = path.join(__dirname, 'certificates');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const ERROR_MAPPING_FILE = path.join(__dirname, 'error-mapping.json');

// Ensure certificates directory exists
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR);
}

// Helper function to get error details from mapping
function getErrorDetails(errorCode) {
  try {
    if (!fs.existsSync(ERROR_MAPPING_FILE)) {
      console.log('Error mapping file not found');
      return null;
    }
    
    const errorMapping = JSON.parse(fs.readFileSync(ERROR_MAPPING_FILE, 'utf8'));
    return errorMapping[errorCode] || null;
  } catch (error) {
    console.error('Error reading error mapping:', error);
    return null;
  }
}

// Helper function to validate key format
function validateKeyFormat(key, type) {
  console.log(`\nValidating ${type} format...`);
  console.log('Key content (first 100 chars):', key.substring(0, 100));
  console.log('Key length:', key.length);

  let isValid = false;
  let validStart = '';
  let validEnd = '';

  switch (type) {
    case 'sslServerCert':
      validStart = '-----BEGIN CERTIFICATE-----';
      validEnd = '-----END CERTIFICATE-----';
      break;
    case 'sslClientKey':
      validStart = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----'];
      validEnd = ['-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----', '-----END EC PRIVATE KEY-----'];
      break;
    case 'mleServerKey':
      validStart = ['-----BEGIN PUBLIC KEY-----', '-----BEGIN RSA PUBLIC KEY-----', '-----BEGIN CERTIFICATE-----'];
      validEnd = ['-----END PUBLIC KEY-----', '-----END RSA PUBLIC KEY-----', '-----END CERTIFICATE-----'];
      break;
    case 'mleClientKey':
      validStart = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----'];
      validEnd = ['-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----', '-----END EC PRIVATE KEY-----'];
      break;
  }

  if (Array.isArray(validStart)) {
    isValid = validStart.some(start => key.includes(start)) && 
              validEnd.some(end => key.includes(end));
  } else {
    isValid = key.includes(validStart) && key.includes(validEnd);
  }

  if (!isValid) {
    console.error(`Invalid ${type} format. Expected to find:`, validStart, 'and', validEnd);
    throw new Error(`Invalid ${type} format`);
  }

  console.log(`${type} format validation successful`);
  return true;
}

// Helper function to save settings
function saveSettings(settings) {
  // Validate required fields
  const requiredFields = [
    'sslServerCert', 'sslClientKey',
    'userId', 'password', 'keyId'
  ];

  for (const field of requiredFields) {
    if (!settings[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate certificate and key formats
  validateKeyFormat(settings.sslServerCert, 'sslServerCert');
  validateKeyFormat(settings.sslClientKey, 'sslClientKey');

  // Validate MLE keys if provided and jose is available
  if (jose) {
    if (settings.mleServerKey) {
      validateKeyFormat(settings.mleServerKey, 'mleServerKey');
    }
    if (settings.mleClientKey) {
      validateKeyFormat(settings.mleClientKey, 'mleClientKey');
    }
  }

  // Save settings to file
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Helper function to load settings
function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

// Helper function to create base64 credentials
function createBase64Credentials(userId, password) {
  console.log('Creating base64 credentials...');
  console.log('User ID:', userId);
  console.log('Password length:', password ? password.length : 0);
  const credentials = Buffer.from(`${userId}:${password}`).toString('base64');
  console.log('Base64 credentials length:', credentials.length);
  return credentials;
}

// Helper function to encrypt payload using MLE
async function encryptPayload(payload, mleServerKey, keyId) {
  if (!jose) {
    console.log('MLE not available: jose module not found');
    return payload;
  }

  if (!mleServerKey) {
    console.log('MLE not configured: MLE Server Key not provided');
    return payload;
  }

  if (!keyId) {
    console.log('MLE not configured: Key ID not provided');
    return payload;
  }

  console.log('\n=== Encryption Process Start ===');
  console.log('Input Payload:', payload);
  console.log('Input Payload Type:', typeof payload);
  console.log('Using Key ID:', keyId);
  
  try {
    // Handle certificate format
    let publicKey;
    if (mleServerKey.includes('-----BEGIN CERTIFICATE-----')) {
      console.log('Converting certificate to public key...');
      const cert = createPublicKey({
        key: mleServerKey,
        format: 'pem'
      });
      publicKey = cert;
    } else {
      publicKey = await jose.importSPKI(mleServerKey, 'RSA-OAEP-256');
    }

    console.log('\nPublic key created successfully');
    
    // Ensure payload is a string
    const payloadToEncrypt = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    console.log('\nPayload after stringification:');
    console.log('Type:', typeof payloadToEncrypt);
    console.log('Content:', payloadToEncrypt);
    
    // Create JWE with explicit kid matching keyId and iat timestamp
    console.log('\nCreating JWE token...');
    const jwe = await new jose.CompactEncrypt(
      new TextEncoder().encode(payloadToEncrypt)
    )
      .setProtectedHeader({ 
        alg: 'RSA-OAEP-256',  // Key encryption algorithm
        enc: 'A128GCM',       // Content encryption algorithm (changed to match Java)
        kid: keyId,           // Key ID
        iat: Date.now()       // Issued at timestamp in milliseconds
      })
      .encrypt(publicKey);

    // Wrap the JWE in an encData object to match Java implementation
    const wrappedJwe = {
      encData: jwe
    };

    console.log('\nFinal Encrypted Payload:');
    console.log(JSON.stringify(wrappedJwe));
    console.log('=== Encryption Process End ===\n');
    
    return JSON.stringify(wrappedJwe);
  } catch (error) {
    console.error('\nEncryption failed:', error);
    throw error;
  }
}

// Add decryption function
async function decryptResponse(encryptedData) {
  try {
    if (!jose || !encryptedData || !encryptedData.encData) {
      return encryptedData;
    }

    const settings = loadSettings();
    if (!settings || !settings.mleClientKey) {
      return encryptedData;
    }

    console.log('\n=== Decryption Process Start ===');
    console.log('Raw Encrypted Data:', encryptedData);

    try {
      // Create private key from PEM
      let privateKey;
      if (settings.mleClientKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // Already in PKCS#8 format
        privateKey = await jose.importPKCS8(settings.mleClientKey, 'RSA-OAEP-256');
      } else if (settings.mleClientKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        // Convert from PKCS#1 to PKCS#8
        const key = createPrivateKey({
          key: settings.mleClientKey,
          format: 'pem'
        });
        privateKey = await jose.importPKCS8(key.export({ type: 'pkcs8', format: 'pem' }), 'RSA-OAEP-256');
      } else {
        throw new Error('Unsupported private key format');
      }

      console.log('Private key imported successfully');
      
      // Decrypt the JWE
      console.log('\nAttempting decryption...');
      const decryptedResult = await jose.compactDecrypt(encryptedData.encData, privateKey);
      console.log('Decryption successful');
      
      // Get the decrypted text
      const decryptedText = new TextDecoder().decode(decryptedResult.plaintext);
      console.log('Decrypted Text:', decryptedText);
      
      // Try to parse as JSON
      let decryptedJson;
      try {
        decryptedJson = JSON.parse(decryptedText);
        console.log('\nDecrypted JSON:', decryptedJson);
      } catch (parseError) {
        console.log('Decrypted text is not JSON, returning as is');
        decryptedJson = decryptedText;
      }
      
      console.log('=== Decryption Process End ===\n');
      return decryptedJson;
    } catch (error) {
      console.error('Failed to decrypt:', error);
      throw error;
    }
  } catch (error) {
    console.error('\nDecryption failed with error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log the full error details
    if (error.code) console.error('Error code:', error.code);
    if (error.cause) console.error('Error cause:', error.cause);
    
    return encryptedData;
  }
}

// Endpoint to load settings
app.get('/api/visa/load-settings', (req, res) => {
  try {
    const settings = loadSettings();
    res.json({ 
      settings, 
      settingsSaved: !!settings,
      mleAvailable: !!jose 
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Endpoint to save settings
app.post('/api/visa/save-settings', (req, res) => {
  try {
    const settings = req.body;
    saveSettings(settings);
    res.json({ 
      message: 'Settings saved successfully',
      mleAvailable: !!jose
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint to make Visa API request
app.post('/api/visa/transaction', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings) {
      console.error('Settings not found');
      return res.status(400).json({ error: 'Settings not found. Please save settings first.' });
    }

    const { payload, apiUrl, method = 'GET' } = req.body;
    
    // Validate request
    console.log('\n=== Request Validation ===');
    console.log('Method:', method);
    console.log('API URL:', apiUrl);
    console.log('Payload:', payload);
    console.log('Settings:', {
      userId: settings.userId ? 'Present' : 'Missing',
      password: settings.password ? 'Present' : 'Missing',
      keyId: settings.keyId ? 'Present' : 'Missing',
      sslServerCert: settings.sslServerCert ? 'Present' : 'Missing',
      sslClientKey: settings.sslClientKey ? 'Present' : 'Missing',
      mleServerKey: settings.mleServerKey ? 'Present' : 'Missing',
      mleClientKey: settings.mleClientKey ? 'Present' : 'Missing'
    });

    if (!apiUrl) {
      console.error('API URL is missing');
      return res.status(400).json({ error: 'API URL is required' });
    }

    if (method === 'POST' && !payload) {
      console.error('Payload is missing for POST request');
      return res.status(400).json({ error: 'Payload is required for POST requests' });
    }

    // Create base64 credentials
    const credentials = createBase64Credentials(settings.userId, settings.password);

    // Encrypt payload if it's a POST request
    let requestData = payload;
    if (method === 'POST') {
      console.log('\nEncrypting payload...');
      try {
        const encryptedPayload = await encryptPayload(payload, settings.mleServerKey, settings.keyId);
        console.log('Encryption successful');
        requestData = encryptedPayload;
      } catch (encryptError) {
        console.error('Encryption failed:', encryptError);
        return res.status(500).json({ 
          error: 'Failed to encrypt payload',
          details: encryptError.message
        });
      }
    }

    // Configure HTTPS agent
    const httpsAgent = new https.Agent({
      cert: settings.sslServerCert,
      key: settings.sslClientKey,
      rejectUnauthorized: true,
      secureProtocol: 'TLSv1_2_method'
    });

    // Configure proxy if enabled
    let proxyConfig = null;
    if (settings.useProxy && settings.proxyHost && settings.proxyPort) {
      proxyConfig = {
        host: settings.proxyHost,
        port: settings.proxyPort,
        protocol: 'http:', // Use HTTP for proxy connection
        auth: settings.proxyUsername && settings.proxyPassword ? 
          `${settings.proxyUsername}:${settings.proxyPassword}` : undefined
      };

      // Add proxy error handling
      httpsAgent.on('error', (error) => {
        console.error('Proxy connection error:', error);
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Failed to connect to proxy server at ${settings.proxyHost}:${settings.proxyPort}. Please check if the proxy server is running and accessible.`);
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error(`Proxy connection timed out. Please check your proxy server settings and network connection.`);
        } else {
          throw new Error(`Proxy error: ${error.message}`);
        }
      });
    }

    // Prepare request headers
    const requestHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'User-Agent': 'Visa API Client',
      'Host': new URL(apiUrl).host,
      'keyId': settings.keyId
    };

    console.log('\n=== Request Details ===');
    console.log('URL:', apiUrl);
    console.log('Method:', method);
    console.log('Headers:', requestHeaders);
    console.log('Request Data:', requestData);
    if (proxyConfig) {
      console.log('Proxy Config:', proxyConfig);
    }

    try {
      // Make request to Visa API
      const response = await axios({
        method: method.toLowerCase(),
        url: apiUrl,
        headers: requestHeaders,
        data: requestData,
        httpsAgent,
        proxy: proxyConfig,
        timeout: 30000, // 30 second timeout
        validateStatus: function (status) {
          return status >= 200 && status < 500; // Accept all responses between 200 and 499
        }
      });

      console.log('\n=== Visa API Response Details ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
      console.log('Response Data Type:', typeof response.data);
      console.log('Raw Response Data:', response.data);
      console.log('================================\n');

      // For 200 responses, return the data as is
      res.json({
        status: response.status,
        data: response.data,
        headers: response.headers,
        isEncrypted: false
      });

    } catch (axiosError) {
      console.error('\n=== Visa API Request Failed ===');
      console.error('Error details:', {
        message: axiosError.message,
        code: axiosError.code,
        response: axiosError.response ? {
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers
        } : 'No response'
      });
      
      if (axiosError.response) {
        const errorData = axiosError.response.data;
        let decryptedData = null;

        // Only attempt decryption if encData is present in error response
        if (errorData && errorData.encData) {
          try {
            decryptedData = await decryptResponse(errorData);
          } catch (decryptError) {
            console.error('Failed to decrypt error response:', decryptError);
          }
        }

        // Extract error code and get mapped details
        const errorCode = errorData?.responseStatus?.code || decryptedData?.responseStatus?.code;
        const errorDetails = errorCode ? getErrorDetails(errorCode) : null;

        // Format the response
        const formattedResponse = {
          error: 'Visa API request failed',
          details: errorData,
          status: axiosError.response.status,
          data: decryptedData || errorData,
          decryptedData: decryptedData,
          isEncrypted: !!errorData.encData,
          headers: axiosError.response.headers,
          errorCode: errorCode,
          errorMapping: errorDetails
        };

        return res.status(axiosError.response.status).json(formattedResponse);
      } else if (axiosError.request) {
        return res.status(500).json({
          error: 'No response received from Visa API',
          details: axiosError.message,
          status: 500,
          data: null,
          decryptedData: null,
          isEncrypted: false,
          headers: null
        });
      } else {
        return res.status(500).json({
          error: 'Error setting up Visa API request',
          details: axiosError.message,
          status: 500,
          data: null,
          decryptedData: null,
          isEncrypted: false,
          headers: null
        });
      }
    }
  } catch (error) {
    console.error('\nError in transaction endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Add new endpoint for decrypting error response data
app.post('/api/visa/decrypt', async (req, res) => {
  try {
    const { encryptedData } = req.body;
    
    if (!encryptedData) {
      return res.status(400).json({ error: 'No encrypted data provided' });
    }

    const settings = loadSettings();
    if (!settings || !settings.mleClientKey) {
      return res.status(400).json({ error: 'MLE Client Key not available for decryption' });
    }

    console.log('\n=== Decrypting Error Response Data ===');
    console.log('Encrypted Data:', encryptedData);

    try {
      // Create private key from PEM
      let privateKey;
      if (settings.mleClientKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // Already in PKCS#8 format
        privateKey = await jose.importPKCS8(settings.mleClientKey, 'RSA-OAEP-256');
      } else if (settings.mleClientKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        // Convert from PKCS#1 to PKCS#8
        const key = createPrivateKey({
          key: settings.mleClientKey,
          format: 'pem'
        });
        privateKey = await jose.importPKCS8(key.export({ type: 'pkcs8', format: 'pem' }), 'RSA-OAEP-256');
      } else {
        throw new Error('Unsupported private key format');
      }

      console.log('Private key imported successfully');
      
      // Decrypt the JWE
      console.log('\nAttempting decryption...');
      const decryptedResult = await jose.compactDecrypt(encryptedData, privateKey);
      console.log('Decryption successful');
      
      // Get the decrypted text
      const decryptedText = new TextDecoder().decode(decryptedResult.plaintext);
      console.log('Decrypted Text:', decryptedText);
      
      // Try to parse as JSON
      let decryptedJson;
      try {
        decryptedJson = JSON.parse(decryptedText);
        console.log('\nDecrypted JSON:', decryptedJson);
      } catch (parseError) {
        console.log('Decrypted text is not JSON, returning as is');
        decryptedJson = decryptedText;
      }
      
      console.log('=== Decryption Complete ===\n');
      
      res.json({ decryptedData: decryptedJson });
    } catch (error) {
      console.error('Decryption failed:', error);
      res.status(500).json({ 
        error: 'Failed to decrypt data',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    details: err.stack
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`MLE support: ${jose ? 'enabled' : 'disabled'}`);
}); 