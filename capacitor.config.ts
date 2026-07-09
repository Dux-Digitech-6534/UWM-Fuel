import type { CapacitorConfig } from '@capacitor/cli'

// THIN-SHELL (OTA): the APK loads the app from the live server URL below. The web
// app is DEPLOYED to Frappe (see deploy-spa.sh), so future changes ship by
// re-deploying the web build — NO APK rebuild/reinstall needed.
//
// Because the WebView loads the app same-origin with the Frappe site, the session
// cookie is first-party and is sent on every /api request automatically. Auth is
// driven by get_boot_data (never by reading document.cookie), so the old
// "stuck on login" WebView bug does not occur.
const config: CapacitorConfig = {
  appId: 'com.duxdigitech.uwmfuel',
  appName: 'UWM Fuel',
  webDir: 'dist', // used only as a fallback; server.url takes precedence
  server: {
    url: 'https://uwmerp.duxdigitech.in/waste_management_ujjain/m',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#5C4DE6',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}
export default config
