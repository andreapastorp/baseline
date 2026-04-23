import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('%c♠  PLANNING POKER', 'font-family: monospace; font-weight: 700; font-size: 16px; color: oklch(0.62 0.18 58);')
console.log('%cYou found the command line. This grants no additional privileges.\nPoints are final after consensus. No rounding up.', 'font-size: 11px; color: #888; line-height: 1.6;')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
