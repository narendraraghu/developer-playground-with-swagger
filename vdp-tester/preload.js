// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('Preload script loaded!');

contextBridge.exposeInMainWorld('vdpApi', {
  sendRequest: async (request, credentials) => {
    // Write cert and key to temp files for main process to read
    let certPath, keyPath;
    if (credentials.certFile) {
      certPath = path.join(os.tmpdir(), `vdp_cert_${Date.now()}`);
      fs.writeFileSync(certPath, Buffer.from(credentials.certFile));
    }
    if (credentials.keyFile) {
      keyPath = path.join(os.tmpdir(), `vdp_key_${Date.now()}`);
      fs.writeFileSync(keyPath, Buffer.from(credentials.keyFile));
    }
    const result = await ipcRenderer.invoke('vdp-api-request', {
      ...request,
      credentials: {
        ...credentials,
        certPath,
        keyPath,
      },
    });
    // Clean up temp files
    if (certPath) fs.unlinkSync(certPath);
    if (keyPath) fs.unlinkSync(keyPath);
    return result;
  },
  testGoogle: async () => {
    return await ipcRenderer.invoke('test-google');
  }
});

contextBridge.exposeInMainWorld('visaApi', {
  helloWorld: async ({ userId, password, cert, key }) => {
    // cert and key should be ArrayBuffer or string
    return await ipcRenderer.invoke('visa-hello', { userId, password, cert, key });
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // Placeholder for exposing secure APIs
});

window.vdpApi.testGoogle().then(console.log); 