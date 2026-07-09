import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import * as api from './api'
import { loadRemembered, saveRemembered, clearRemembered, Remembered } from './storage'

export type Boot = {
  user: string
  full_name: string
  user_image?: string
  roles: string[]
  company: string
  default_warehouse: string
  permissions: {
    fuel_for_stock: { read: boolean; create: boolean; write: boolean; delete: boolean }
    fuel_for_distribution: { read: boolean; create: boolean; write: boolean; delete: boolean }
  }
  can_use: boolean
  stock_summary: { fuel_type: string; warehouse: string; available_stock: number | null; as_of: string }
  recent_activity: any[]
  csrf_token: string
}

type Status = 'loading' | 'authed' | 'guest'
type AuthCtx = {
  status: Status
  boot: Boot | null
  remembered: Remembered
  login: (usr: string, pwd: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
  refreshBoot: () => Promise<void>
}
const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [boot, setBoot] = useState<Boot | null>(null)
  const [remembered, setRemembered] = useState<Remembered>({ user: '', remember: false, pw: '' })

  const applyBoot = useCallback((b: Boot) => {
    api.setCsrf(b.csrf_token)
    setBoot(b)
    setStatus('authed')
  }, [])

  // Cold start: if the persisted session still validates, go straight to Home.
  // Otherwise, if the user ticked "Remember me", silently sign in with the stored
  // credentials so they don't have to type the password again. Else show Login.
  useEffect(() => {
    (async () => {
      const rem = await loadRemembered()
      setRemembered(rem)
      try {
        applyBoot(await api.getBootData())
        return
      } catch { /* session missing/expired */ }
      if (rem.remember && rem.user && rem.pw) {
        try {
          await api.login(rem.user, rem.pw)
          applyBoot(await api.getBootData())
          return
        } catch { /* stored creds no longer valid */ }
      }
      setStatus('guest')
    })()
  }, [applyBoot])

  const login = useCallback(async (usr: string, pwd: string, remember: boolean) => {
    // 1) login  2) confirm via boot (rides the native session cookie)
    await api.login(usr, pwd)
    let b: Boot
    try {
      b = await api.getBootData()
    } catch (e) {
      // logged in but boot failed -> clear session, surface a friendly error
      await api.logout()
      throw e
    }
    // 3) persist remember-me choice (username + password when ticked)
    if (remember) { await saveRemembered(usr, pwd); setRemembered({ user: usr, remember: true, pw: pwd }) }
    else { await clearRemembered(); setRemembered({ user: '', remember: false, pw: '' }) }
    // 4) flip authenticated state (App navigates to Home with replace)
    applyBoot(b)
  }, [applyBoot])

  const logout = useCallback(async () => {
    await api.logout()
    await clearRemembered()
    setRemembered({ user: '', remember: false, pw: '' })
    setBoot(null)
    setStatus('guest')
  }, [])

  const refreshBoot = useCallback(async () => {
    try { const b = await api.getBootData(); applyBoot(b) } catch { /* ignore */ }
  }, [applyBoot])

  return (
    <Ctx.Provider value={{ status, boot, remembered, login, logout, refreshBoot }}>
      {children}
    </Ctx.Provider>
  )
}
