import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@ui5/webcomponents-react/dist/Assets.js'
import '@ui5/webcomponents/dist/Assets.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
