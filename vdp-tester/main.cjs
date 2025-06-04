const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.webContents.openDevTools();
    win.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 

// IPC handler for Visa Hello World API
ipcMain.handle('visa-hello', async (event, { userId, password, cert, key }) => {
  try {
    // Write cert and key to temp files
    const certPath = path.join(app.getPath('temp'), `visa_cert_${Date.now()}.pem`);
    const keyPath = path.join(app.getPath('temp'), `visa_key_${Date.now()}.pem`);
    fs.writeFileSync(certPath, cert);
    fs.writeFileSync(keyPath, key);

    const basicAuth = Buffer.from(`${userId}:${password}`).toString('base64');
    const response = await axios({
      method: 'GET',
      url: 'https://sandbox.api.visa.com/vdp/helloworld',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
      httpsAgent: new (require('https').Agent)({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        rejectUnauthorized: false, // For sandbox only!
      }),
      timeout: 20000,
    });

    // Clean up temp files
    fs.unlinkSync(certPath);
    fs.unlinkSync(keyPath);

    return { data: response.data, status: response.status };
  } catch (err) {
    return { error: err.message, details: err.response?.data || null };
  }
});

console.log('Preload path:', path.join(__dirname, 'preload.js')); 