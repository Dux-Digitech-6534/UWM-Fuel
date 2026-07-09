import { App as CapApp } from '@capacitor/app'

// Makes over-the-air updates reliable. Each deploy stamps a build id into the host
// page (window.__UWM_BUILD). When the app becomes visible/active we re-fetch the host
// page (no-store) and, if the deployed build id differs from the one this instance
// loaded with, we reload once to pull the new code. No-op when nothing changed.
const loadedBuild = String((window as any).__UWM_BUILD || '')

async function checkAndReload() {
  if (!loadedBuild) return
  try {
    const res = await fetch(window.location.pathname + '?_=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return
    const html = await res.text()
    const m = html.match(/__UWM_BUILD\s*=\s*["']([^"']+)["']/)
    if (m && m[1] && m[1] !== loadedBuild) window.location.reload()
  } catch { /* offline / ignore */ }
}

export function initAutoUpdate() {
  try {
    CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) checkAndReload() })
  } catch { /* not native */ }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkAndReload()
  })
}
