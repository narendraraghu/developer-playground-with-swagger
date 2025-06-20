const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { createPublicKey, createPrivateKey } = require('crypto');
const errorMapping = require('./error-mapping.json');
const resourcePathMapping = require('./resource-path-mapping.json');

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
  // Check authentication method
  const authMethod = settings.authMethod || 'mutualAuth';
  
  if (authMethod === 'mutualAuth') {
    // Validate required fields for Mutual Authentication
    const requiredMutualAuthFields = [
      'sslServerCert', 'sslClientKey', 'userId', 'password'
    ];

    for (const field of requiredMutualAuthFields) {
      if (!settings[field]) {
        throw new Error(`Missing required field for Mutual Authentication: ${field}`);
      }
    }

    // Validate certificate and key formats for Mutual Authentication
    validateKeyFormat(settings.sslServerCert, 'sslServerCert');
    validateKeyFormat(settings.sslClientKey, 'sslClientKey');
  } else if (authMethod === 'xpayToken') {
    // Validate required fields for X-Pay-Token Authentication
    const requiredXPayTokenFields = [
      'apiKey', 'sharedSecret', 'resourcePath'
    ];

    for (const field of requiredXPayTokenFields) {
      if (!settings[field]) {
        throw new Error(`Missing required field for X-Pay-Token Authentication: ${field}`);
      }
    }
  }

  // Validate MLE keys if provided and jose is available (applies to both auth methods)
  if (jose) {
    if (settings.mleServerKey) {
      validateKeyFormat(settings.mleServerKey, 'mleServerKey');
    }
    if (settings.mleClientKey) {
      validateKeyFormat(settings.mleClientKey, 'mleClientKey');
    }
    
    // If MLE keys are provided, keyId is required
    if ((settings.mleServerKey || settings.mleClientKey) && !settings.keyId) {
      throw new Error('MLE Key ID is required when MLE keys are provided');
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

// Helper function to configure HTTPS agent with proxy if enabled
function createHttpsAgent(settings) {
  const agentConfig = {
    cert: settings.sslServerCert,
    key: settings.sslClientKey,
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_2_method'
  };

  if (settings.useProxy && settings.proxyHost && settings.proxyPort) {
    agentConfig.proxy = {
      host: settings.proxyHost,
      port: settings.proxyPort,
      protocol: 'http:', // Use HTTP for proxy connection
      auth: settings.proxyUsername && settings.proxyPassword ? 
        `${settings.proxyUsername}:${settings.proxyPassword}` : undefined
    };

    // Add proxy error handling
    agentConfig.on('error', (error) => {
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

// Endpoint to make Visa API request (This will be replaced by the proxy endpoint)
// app.post('/api/visa/transaction', async (req, res) => {
//   // ... existing transaction endpoint logic ...
// });

// Add proxy endpoint for API requests
app.post('/api/visa/proxy', async (req, res) => {
  console.log('\n=== Incoming Proxy Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  try {
    const { url, method, payload, headers: customHeaders = {}, authMethod = 'mutualAuth' } = req.body;
    
    // Load settings
    const settings = loadSettings();
    if (!settings) {
      console.error('Settings not found');
      return res.status(400).json({ error: 'Settings not found. Please configure settings first.' });
    }

    // Configure HTTPS agent
    const httpsAgent = createHttpsAgent(settings);

    // Prepare request headers based on authentication method
    let requestHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Visa API Client',
      'Host': new URL(url).host,
      ...customHeaders // Merge custom headers
    };

    let finalUrl = url;
    let requestData = payload; // Start with the raw payload
    let encBody = null; // For MLE+X-Pay-Token

    if (authMethod === 'mutualAuth') {
      // Mutual Authentication - use Basic Auth with userId/password
      if (!settings.userId || !settings.password) {
        return res.status(400).json({ 
          error: 'Mutual Authentication requires User ID and Password. Please configure settings first.' 
        });
      }
      
      const credentials = createBase64Credentials(settings.userId, settings.password);
      requestHeaders['Authorization'] = `Basic ${credentials}`;
      
      if (settings.keyId) {
        requestHeaders['keyId'] = settings.keyId;
      }
    } else if (authMethod === 'xpayToken') {
      // X-Pay-Token Authentication - use API Key and Shared Secret
      if (!settings.apiKey || !settings.sharedSecret || !settings.resourcePath) {
        return res.status(400).json({ 
          error: 'X-Pay-Token Authentication requires API Key, Shared Secret, and Resource Path. Please configure settings first.' 
        });
      }
      
      console.log('\n=== X-Pay-Token Authentication Setup ===');
      console.log('API Key:', settings.apiKey);
      console.log('Shared Secret length:', settings.sharedSecret ? settings.sharedSecret.length : 0);
      console.log('Resource Path:', settings.resourcePath);
      
      // Generate X-Pay-Token according to Visa specifications
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Ensure urlObj is defined
      const urlObj = new URL(url);
      // Extract resource path using mapping file if available
      let resourcePath = urlObj.pathname;
      // Try to match the base path from the mapping file
      const mappingKeys = Object.keys(resourcePathMapping);
      let matched = false;
      for (const base of mappingKeys) {
        if (resourcePath.startsWith(base)) {
          resourcePath = resourcePathMapping[base] + resourcePath.substring(base.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Fallback to previous logic
        if (resourcePath.startsWith('/vdp/')) {
          resourcePath = resourcePath.substring(5);
        } else if (resourcePath.startsWith('/visadirect/')) {
          resourcePath = resourcePath.substring('/visadirect/'.length);
        }
      }
      // Extract query string WITHOUT the leading '?', and sort params lexicographically
      let queryParams = '';
      if (urlObj.search && urlObj.search.length > 1) {
        // Remove leading '?', split, sort, and join
        let params = urlObj.search.substring(1).split('&').filter(Boolean);
        params.push(`apiKey=${settings.apiKey}`); // Always add apiKey
        params = params.map(p => p.split('='));
        params.sort((a, b) => a[0].localeCompare(b[0]));
        queryParams = params.map(p => p.join('=')).join('&');
      } else {
        queryParams = `apiKey=${settings.apiKey}`;
      }
      // --- MLE + X-Pay-Token special handling ---
      let postBody = '';
      if (method.toUpperCase() === 'POST' && jose && settings.mleServerKey && settings.keyId) {
        console.log('\nAttempting to encrypt payload for X-Pay-Token hash and request...');
        try {
          // Always use minified JSON for encryption
          const minifiedPayload = JSON.stringify(typeof payload === 'string' ? JSON.parse(payload) : payload);
          const jweString = await encryptPayload(minifiedPayload, settings.mleServerKey, settings.keyId);
          encBody = JSON.stringify({ encData: JSON.parse(jweString).encData });
          postBody = encBody;
          requestData = encBody;
          console.log('Payload encrypted and encBody prepared for hash and request.');
        } catch (encryptError) {
          console.error('Payload encryption failed:', encryptError);
          return res.status(500).json({ 
            error: 'Failed to encrypt payload for POST request',
            details: encryptError.message
          });
        }
      } else if (method.toUpperCase() === 'POST') {
        // No MLE, just use minified JSON
        postBody = JSON.stringify(typeof payload === 'string' ? JSON.parse(payload) : payload);
        requestData = postBody;
      }
      // For GET, postBody remains ''
      // Create message string: timestamp + resource_path + query_string + request_body
      const message = timestamp + resourcePath + queryParams + postBody;
      // Generate HMAC-SHA256 hash: SHA256HMAC(shared_secret, message)
      const crypto = require('crypto');
      const hashString = crypto.createHmac('SHA256', settings.sharedSecret)
        .update(message)
        .digest('hex');
      // Create X-Pay-Token: "xv2:" + timestamp + ":" + SHA256HMAC(shared_secret, message)
      const xPayToken = `xv2:${timestamp}:${hashString}`;
      // For the actual request, set the query string WITH the leading '?'
      urlObj.search = '?' + queryParams;
      finalUrl = urlObj.toString();
      
      console.log('\n=== X-Pay-Token Generation (Visa Specification) ===');
      console.log('HMAC Input (shared_secret):', settings.sharedSecret.substring(0, 10) + '...');
      console.log('HMAC Input (message):', message);
      console.log('HMAC Output (hash):', hashString);
      console.log('HMAC Output length:', hashString.length);
      console.log('Final X-Pay-Token:', xPayToken);
      console.log('X-Pay-Token length:', xPayToken.length);
      
      // Validate X-Pay-Token format
      const tokenParts = xPayToken.split(':');
      if (tokenParts.length !== 3) {
        console.error('ERROR: X-Pay-Token format is incorrect. Expected 3 parts, got:', tokenParts.length);
        return res.status(500).json({ 
          error: 'X-Pay-Token format is incorrect',
          details: 'Token should be in format: xv2:timestamp:hash'
        });
      }
      
      if (tokenParts[0] !== 'xv2') {
        console.error('ERROR: X-Pay-Token version is incorrect. Expected "xv2", got:', tokenParts[0]);
        return res.status(500).json({ 
          error: 'X-Pay-Token version is incorrect',
          details: 'Token should start with "xv2:"'
        });
      }
      
      console.log('X-Pay-Token validation passed');
      console.log('Token parts:', tokenParts);
      
      // Add X-Pay-Token to headers (using uppercase as per Visa specifications)
      requestHeaders['X-PAY-TOKEN'] = xPayToken;
      
      console.log('\n=== Request Headers for X-Pay-Token ===');
      console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
      
      // Additional debugging for potential issues
      console.log('\n=== Additional Debug Info ===');
      console.log('Current time (ISO):', new Date().toISOString());
      console.log('Current time (Unix):', Math.floor(Date.now() / 1000));
      console.log('Token timestamp:', timestamp);
      console.log('Time difference:', Math.floor(Date.now() / 1000) - timestamp);
      
      // Check if shared secret might be the issue
      console.log('Shared Secret first 10 chars:', settings.sharedSecret.substring(0, 10) + '...');
      console.log('Shared Secret last 10 chars:', '...' + settings.sharedSecret.substring(settings.sharedSecret.length - 10));
      console.log('Shared Secret length:', settings.sharedSecret.length);
      console.log('Shared Secret contains spaces:', settings.sharedSecret.includes(' '));
      console.log('Shared Secret contains newlines:', settings.sharedSecret.includes('\n'));
      console.log('Shared Secret contains carriage returns:', settings.sharedSecret.includes('\r'));
      
      // Check API key
      console.log('API Key first 10 chars:', settings.apiKey.substring(0, 10) + '...');
      console.log('API Key last 10 chars:', '...' + settings.apiKey.substring(settings.apiKey.length - 10));
      console.log('API Key length:', settings.apiKey.length);
      console.log('API Key contains spaces:', settings.apiKey.includes(' '));
      console.log('API Key contains newlines:', settings.apiKey.includes('\n'));
      
      // Test HMAC with a known value to verify crypto is working
      const testMessage = 'test';
      const testHash = crypto.createHmac('SHA256', settings.sharedSecret)
        .update(testMessage)
        .digest('hex');
      console.log('Test HMAC (test message):', testHash.substring(0, 16) + '...');
      
      // Remove Authorization header for X-Pay-Token (not needed)
      delete requestHeaders['Authorization'];
    }

    // If not POST+MLE+X-Pay-Token, but POST+MLE+mutualAuth, handle encryption here
    if (method.toUpperCase() === 'POST' && jose && settings.mleServerKey && settings.keyId && !(authMethod === 'xpayToken')) {
      console.log('\nAttempting to encrypt payload...');
      try {
        const minifiedPayload = JSON.stringify(typeof payload === 'string' ? JSON.parse(payload) : payload);
        requestData = await encryptPayload(minifiedPayload, settings.mleServerKey, settings.keyId);
        console.log('Payload encrypted successfully.');
      } catch (encryptError) {
        console.error('Payload encryption failed:', encryptError);
        return res.status(500).json({ 
          error: 'Failed to encrypt payload for POST request',
          details: encryptError.message
        });
      }
    }

    console.log('\n=== Proxying Request to Visa API ===');
    console.log('URL:', finalUrl);
    console.log('Method:', method);
    console.log('Auth Method:', authMethod);
    console.log('Headers:', requestHeaders); // Log headers being sent
    console.log('Request Data (after potential encryption):', requestData); // Log payload being sent
    if (method.toUpperCase() === 'POST' && requestData !== payload) {
        console.log('Original Payload (before encryption):', payload); // Log original payload if encrypted
    }

    try {
      // Make request to Visa API
      console.log('\n=== Making Request to Visa API ===');
      const response = await axios({
        method: method.toLowerCase(),
        url: finalUrl,
        headers: requestHeaders,
        data: requestData, // Use the potentially encrypted payload
        httpsAgent,
        proxy: settings.useProxy && settings.proxyHost && settings.proxyPort ? {
          host: settings.proxyHost,
          port: settings.proxyPort,
          protocol: 'http:',
          auth: settings.proxyUsername && settings.proxyPassword ? 
            `${settings.proxyUsername}:${settings.proxyPassword}` : undefined
        } : false,
        timeout: 30000, // 30 second timeout
        validateStatus: function (status) {
          return status >= 200 && status < 500; // Accept all responses between 200 and 499
        }
      });

      console.log('\n=== Received Response from Visa API ===');
      console.log('Status:', response.status);
      console.log('Response Headers:', response.headers);
      console.log('Response Data:', response.data);

      // Send the response back to the client
      res.status(response.status).json({
        status: response.status,
        data: response.data,
        headers: response.headers,
        isEncrypted: !!response.data?.encData // Indicate if response data might be encrypted
      });

    } catch (axiosError) {
      console.error('\n=== Visa API Request Failed (Axios Error) ===');
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
        // Forward the API error response to the client
        res.status(axiosError.response.status).json({
          error: 'Visa API request failed',
          details: axiosError.response.data,
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers,
          isEncrypted: !!axiosError.response.data?.encData // Indicate if error data might be encrypted
        });
      } else if (axiosError.request) {
        // The request was made but no response was received
        res.status(500).json({
          error: 'No response received from Visa API',
          details: axiosError.message,
          status: 500,
          data: null,
          headers: null,
          isEncrypted: false
        });
      } else {
        // Error setting up the request
        res.status(500).json({
          error: 'Error setting up Visa API request',
          details: axiosError.message,
          status: 500,
          data: null,
          headers: null,
          isEncrypted: false
        });
      }
    }
  } catch (error) {
    console.error('Error processing proxy request:', error);
    res.status(500).json({
      status: 500,
      error: error.message || 'Internal server error'
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

// Add clear settings endpoint
app.post('/api/visa/clear-settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
    res.json({ success: true, message: 'Settings cleared successfully' });
  } catch (error) {
    console.error('Error clearing settings:', error);
    res.status(500).json({ success: false, message: 'Failed to clear settings', error: error.message });
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