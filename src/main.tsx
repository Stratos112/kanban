import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ensureGuestSession } from './lib/auth'
import App from './App.tsx'
import './index.css'

ensureGuestSession()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
  .catch((err) => {
    console.error('Failed to initialize session:', err)
  })
