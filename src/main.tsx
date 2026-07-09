import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { SplashScreen } from '@capacitor/splash-screen'
import App from './App'
import { AuthProvider } from './auth'
import { ToastHost } from './toast'
import { initAutoUpdate } from './autoupdate'
import './theme.css'

initAutoUpdate()

// restore saved theme
try {
  const t = localStorage.getItem('uwm.theme')
  if (t) document.documentElement.setAttribute('data-theme', t)
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastHost>
        <HashRouter>
          <App />
        </HashRouter>
      </ToastHost>
    </AuthProvider>
  </React.StrictMode>,
)

// hide the native splash once the web layer is up
SplashScreen.hide().catch(() => {})
