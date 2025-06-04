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

// Constants
const CERT_DIR = path.join(__dirname, 'certificates');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Ensure certificates directory exists
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR);
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

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return null;
}

// Save settings to file
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw new Error('Failed to save settings');
  }
}

// Create base64 credentials
function createBase64Credentials(userId, password) {
  return Buffer.from(`${userId}:${password}`).toString('base64');
}

// Configure HTTPS agent with proxy if enabled
function createHttpsAgent(settings) {
  const agentConfig = {
    cert: settings.sslServerCert,
    key: settings.sslClientKey,
    rejectUnauthorized: true
  };

  if (settings.useProxy && settings.proxyHost && settings.proxyPort) {
    agentConfig.proxy = {
      host: settings.proxyHost,
      port: settings.proxyPort,
      protocol: 'https:'
    };
  }

  return new https.Agent(agentConfig);
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
      publicKey = createPublicKey({
        key: mleServerKey,
        format: 'pem'
      });
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

    // Parse and decrypt the JWE token
    const jwe = await jose.JWE.createDecrypt(settings.mleClientKey)
      .decrypt(encryptedData.encData);

    // Get the decrypted text
    const decryptedText = new TextDecoder().decode(jwe.plaintext);
    
    // Try to parse as JSON
    try {
      return JSON.parse(decryptedText);
    } catch (parseError) {
      return decryptedText;
    }
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return encryptedData;
  }
}

// API Routes
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

app.post('/api/visa/transaction', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings) {
      return res.status(400).json({ error: 'Settings not found. Please save settings first.' });
    }

    const { payload, apiUrl, method = 'GET' } = req.body;
    
    if (!apiUrl) {
      return res.status(400).json({ error: 'API URL is required' });
    }

    if (method === 'POST' && !payload) {
      return res.status(400).json({ error: 'Payload is required for POST requests' });
    }

    // Create base64 credentials
    const credentials = createBase64Credentials(settings.userId, settings.password);

    // Encrypt payload if it's a POST request
    let requestData = payload;
    if (method === 'POST') {
      try {
        const encryptedPayload = await encryptPayload(payload, settings.mleServerKey, settings.keyId);
        requestData = encryptedPayload;
      } catch (encryptError) {
        return res.status(500).json({ 
          error: 'Failed to encrypt payload',
          details: encryptError.message
        });
      }
    }

    // Configure HTTPS agent with proxy if enabled
    const httpsAgent = createHttpsAgent(settings);

    // Prepare request headers
    const requestHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'User-Agent': 'Visa API Client',
      'Host': new URL(apiUrl).host,
      'keyId': settings.keyId
    };

    try {
      // Make request to Visa API
      const response = await axios({
        method: method.toLowerCase(),
        url: apiUrl,
        headers: requestHeaders,
        data: requestData,
        httpsAgent
      });

      // Handle response data
      let responseData = response.data;
      let decryptedData = null;

      // Check if response is encrypted
      if (typeof responseData === 'string') {
        try {
          const parsedResponse = JSON.parse(responseData);
          if (parsedResponse.encData) {
            decryptedData = await decryptResponse(parsedResponse);
          }
        } catch (parseError) {
          console.log('Response is not JSON or does not contain encData field');
        }
      }

      // Send the response back to the client
      res.json({
        status: response.status,
        data: response.data,
        decryptedData: decryptedData,
        isEncrypted: true,
        headers: response.headers
      });

    } catch (axiosError) {
      if (axiosError.response) {
        const errorData = axiosError.response.data;
        let decryptedData = null;

        // Try to decrypt the error response
        if (errorData && errorData.encData) {
          decryptedData = await decryptResponse(errorData);
        }

        // Format the response
        const formattedResponse = {
          error: 'Visa API request failed',
          details: errorData,
          status: axiosError.response.status,
          data: decryptedData || errorData,
          decryptedData: decryptedData,
          isEncrypted: !!errorData.encData,
          headers: axiosError.response.headers
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
    console.error('Error in transaction endpoint:', error);
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
      const privateKey = await jose.importPKCS8(settings.mleClientKey, 'RSA-OAEP-256');
      
      // Decrypt the JWE
      const decryptedResult = await jose.compactDecrypt(encryptedData, privateKey);
      
      // Get the decrypted text
      const decryptedText = new TextDecoder().decode(decryptedResult.plaintext);
      
      // Try to parse as JSON
      let decryptedJson;
      try {
        decryptedJson = JSON.parse(decryptedText);
      } catch (parseError) {
        decryptedJson = decryptedText;
      }
      
      console.log('Decrypted Data:', decryptedJson);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`MLE support: ${jose ? 'enabled' : 'disabled'}`);
}); 