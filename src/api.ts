import { Capacitor, CapacitorHttp } from '@capacitor/core'

// Live Frappe backend. In the APK, requests go through CapacitorHttp (native),
// which uses the native cookie store so the Frappe session persists across
// requests and app restarts — this is what fixes the WebView login bug. On the
// web (dev), requests are relative and proxied by Vite (see vite.config.ts).
export const BASE = 'https://uwmerp.duxdigitech.in'
const NATIVE = Capacitor.isNativePlatform()
// When the app is SERVED BY Frappe (thin-shell APK loads the hosted URL, or web dev),
// requests are same-origin: use relative fetch so the first-party session cookie is
// sent automatically. Only a fully-bundled build (localhost origin) needs native HTTP.
const HOSTED = typeof window !== 'undefined' && /duxdigitech\.in$/i.test(window.location.hostname)
const USE_NATIVE_HTTP = NATIVE && !HOSTED
const M = 'waste_management_ujjain.mobile_api.uwm_fuel.'

let csrfToken = ''
export function setCsrf(t: string) { csrfToken = t || '' }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

type ReqOpts = { params?: Record<string, any>; data?: any; isPost?: boolean }

function friendly(status: number, data: any): string {
  // Extract a clean, user-facing message — never a raw stack trace.
  try {
    if (data && typeof data === 'object') {
      if (data._server_messages) {
        const arr = JSON.parse(data._server_messages)
        if (arr.length) {
          const first = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0]
          if (first?.message) return String(first.message).replace(/<[^>]+>/g, '')
        }
      }
      if (typeof data.message === 'string' && data.message && !data.message.includes('Traceback'))
        return data.message.replace(/<[^>]+>/g, '')
      if (data.exc_type) return String(data.exc_type).replace(/Error$/, ' error')
    }
  } catch { /* fall through */ }
  if (status === 401 || status === 403) return 'Wrong username or password.'
  if (status === 0) return 'Cannot reach the server. Check your connection.'
  return 'Something went wrong. Please try again.'
}

async function req(path: string, opts: ReqOpts = {}): Promise<any> {
  const { params, data, isPost } = opts
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
  if (isPost) {
    headers['Content-Type'] = 'application/json'
    if (csrfToken) headers['X-Frappe-CSRF-Token'] = csrfToken
  }

  let status = 0
  let body: any = null
  try {
    if (USE_NATIVE_HTTP) {
      const res = await CapacitorHttp.request({
        method: isPost ? 'POST' : 'GET',
        url: BASE + path,
        headers,
        params: params ? toStr(params) : undefined,
        data: isPost ? data : undefined,
      })
      status = res.status
      body = typeof res.data === 'string' ? tryJson(res.data) : res.data
    } else {
      const url = new URL(path, window.location.origin)
      if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)))
      const res = await fetch(url.toString(), {
        method: isPost ? 'POST' : 'GET',
        headers,
        credentials: 'include',
        body: isPost && data != null ? JSON.stringify(data) : undefined,
      })
      status = res.status
      body = tryJson(await res.text())
    }
  } catch (e: any) {
    throw new ApiError(e?.message || 'Network error', 0)
  }
  if (status < 200 || status >= 300) throw new ApiError(friendly(status, body), status)
  return body
}

const toStr = (o: Record<string, any>) => {
  const r: Record<string, string> = {}
  Object.entries(o).forEach(([k, v]) => { if (v != null) r[k] = String(v) })
  return r
}
const tryJson = (s: string) => { try { return JSON.parse(s) } catch { return s } }
const method = (fn: string, o: ReqOpts = {}) => req('/api/method/' + M + fn, o).then((r) => r?.message)

// ---------------- auth ----------------
export async function login(usr: string, pwd: string) {
  // /api/method/login is CSRF-exempt; sets the session cookie natively.
  const r = await req('/api/method/login', { isPost: true, data: { usr, pwd } })
  return r // { message: "Logged In", full_name, home_page }
}
export async function logout() {
  try { await req('/api/method/logout', { isPost: true, data: {} }) } catch { /* ignore */ }
}
export const ping = () => method('ping')
export const getBootData = () => method('get_boot_data')
export const checkPermissions = () => method('check_permissions')

// ---------------- data ----------------
export const searchLink = (kind: string, txt = '', limit = 20) =>
  method('search_link', { params: { kind, txt, limit } }) as Promise<{ value: string; label: string }[]>
export const getAvailableStock = (item: string, warehouse?: string) =>
  method('get_available_stock', { params: { item, warehouse } })
export const lastPurchaseRate = (vendor: string, item: string) =>
  method('last_purchase_rate', { params: { vendor, item } }) as Promise<{ rate: number }>
export const listFuelStock = (limit = 20, start = 0, txt = '') =>
  method('list_fuel_stock', { params: { limit, start, txt } })
export const listFuelDistribution = (limit = 20, start = 0, txt = '') =>
  method('list_fuel_distribution', { params: { limit, start, txt } })
export const getFuelStock = (name: string) => method('get_fuel_stock', { params: { name } })
export const getFuelDistribution = (name: string) => method('get_fuel_distribution', { params: { name } })
export const createFuelStock = (data: any) => method('create_fuel_stock', { isPost: true, data: { data } })
export const createFuelDistribution = (data: any) => method('create_fuel_distribution', { isPost: true, data: { data } })
export const uploadFileB64 = (filename: string, data_b64: string) =>
  method('upload_file_b64', { isPost: true, data: { filename, data_b64, is_private: 1 } }) as Promise<{ file_url: string }>
