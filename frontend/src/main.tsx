import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './components/ThemeProvider'
import { TranslationProvider } from './i18n/useTranslation'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TranslationProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </TranslationProvider>
    </BrowserRouter>
  </StrictMode>,
)
