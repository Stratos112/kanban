import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ensureGuestSession } from './lib/auth'
import App from './App.tsx'
import './index.css'

// Always render — auth failure shows an in-app banner rather than a blank page
ensureGuestSession().catch((err) => {
  console.error('Failed to initialize guest session:', err)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
