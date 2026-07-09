import { Preferences } from '@capacitor/preferences'

// Remember-me storage (device-local, via Capacitor Preferences).
//  - When "Remember me" is ticked we store the username AND the password so the
//    user is signed in automatically next time (their explicit requirement).
//  - The password is base64-obfuscated at rest. Preferences is app-private storage
//    on Android; for stronger at-rest protection a Keystore-backed secure-storage
//    plugin can be added later.
const K_USER = 'uwm.remember.user'
const K_ON = 'uwm.remember.on'
const K_PW = 'uwm.remember.pw'

export type Remembered = { user: string; remember: boolean; pw: string }

const enc = (s: string) => { try { return btoa(unescape(encodeURIComponent(s))) } catch { return '' } }
const dec = (s: string) => { try { return decodeURIComponent(escape(atob(s))) } catch { return '' } }

export async function loadRemembered(): Promise<Remembered> {
  let user = '', on = false, pw = ''
  try { user = (await Preferences.get({ key: K_USER })).value || '' } catch { /* ignore */ }
  try { on = (await Preferences.get({ key: K_ON })).value === '1' } catch { /* ignore */ }
  if (on) { try { pw = dec((await Preferences.get({ key: K_PW })).value || '') } catch { /* ignore */ } }
  return { user, remember: on, pw }
}

export async function saveRemembered(user: string, pw: string) {
  try { await Preferences.set({ key: K_USER, value: user }) } catch { /* ignore */ }
  try { await Preferences.set({ key: K_ON, value: '1' }) } catch { /* ignore */ }
  try { await Preferences.set({ key: K_PW, value: enc(pw) }) } catch { /* ignore */ }
}

export async function clearRemembered() {
  try { await Preferences.remove({ key: K_USER }) } catch { /* ignore */ }
  try { await Preferences.remove({ key: K_ON }) } catch { /* ignore */ }
  try { await Preferences.remove({ key: K_PW }) } catch { /* ignore */ }
}
