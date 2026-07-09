import { useState } from 'react'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { ThemeToggle, Powered } from '../components/ui'
import { LOGO } from '../config'

export default function Login() {
  const { login, remembered } = useAuth()
  const [usr, setUsr] = useState(remembered.user || '')
  const [pwd, setPwd] = useState(remembered.pw || '')
  const [remember, setRemember] = useState(remembered.remember)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!usr.trim() || !pwd) { setErr('Enter your email or username and password.'); return }
    setBusy(true)
    try {
      // NOTE: send the raw string as typed — supports both username and email,
      // no lowercasing, no email validation.
      await login(usr.trim(), pwd, remember)
      // success toast is shown on Home (never here). App switches to Home now.
      try { sessionStorage.setItem('uwm.justLoggedIn', '1') } catch { /* ignore */ }
    } catch (e: any) {
      setErr(e?.message || 'Wrong username or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="login">
        <div className="login-top">
          <div className="brand-lockup">
            <img src={LOGO} alt="UWM" />
            <div><b>UWM Fuel</b><span>uwmerp.duxdigitech.in</span></div>
          </div>
          <ThemeToggle />
        </div>

        <div className="login-hero">
          <div className="mark"><Icon name="truck" size={30} /></div>
          <h1>Sign in</h1>
          <p>Ujjain Waste Management · Fuel operations</p>
        </div>

        <form className="login-card" onSubmit={submit}>
          {err && <div className="banner"><Icon name="alert" size={16} />{err}</div>}

          <div className="login-field">
            <label>Email or username</label>
            <input className="ctrl" autoCapitalize="none" autoCorrect="off" autoComplete="username"
              placeholder="Email or username" value={usr} onChange={(e) => setUsr(e.target.value)} />
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="pw">
              <input className="ctrl" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                placeholder="Password" value={pwd} onChange={(e) => setPwd(e.target.value)} style={{ paddingRight: 44 }} />
              <button type="button" className="eye" onClick={() => setShowPw((s) => !s)} aria-label="Show password">
                <Icon name={showPw ? 'eyeoff' : 'eye'} size={18} />
              </button>
            </div>
          </div>

          <label className="remember" onClick={() => setRemember((r) => !r)}>
            <span className={'box' + (remember ? ' on' : '')}>{remember && <Icon name="check" size={13} />}</span>
            Remember me on this device
          </label>

          <button className="btn primary wide" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : <><Icon name="lock" size={17} />Sign in</>}
          </button>
        </form>

        <div className="login-foot"><Powered /></div>
      </div>
    </div>
  )
}
