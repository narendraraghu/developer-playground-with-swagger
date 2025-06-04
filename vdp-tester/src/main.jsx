import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CredentialProvider } from './context/CredentialContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CredentialProvider>
    <App />
    </CredentialProvider>
  </StrictMode>,
)

window.vdpApi
