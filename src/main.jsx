import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('%c♠ You found the command line. This grants no additional privileges.', 'font-size: 11px; color: #888; line-height: 1.6;')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
