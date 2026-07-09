import { ReactNode, useEffect, useState } from 'react'
import { Icon, IconName } from '../icons'
import { LOGO } from '../config'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading"><div className="spin" />{label}</div>
}
export function EmptyState({ icon = 'box', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <div><b style={{ color: 'var(--fg-2)', fontSize: 14 }}>{title}</b>{sub && <div style={{ marginTop: 4 }}>{sub}</div>}</div>
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <Icon name="alert" size={30} />
      <div style={{ color: 'var(--err)', fontSize: 13.5 }}>{message}</div>
      {onRetry && <button className="btn primary" style={{ maxWidth: 180 }} onClick={onRetry}>
        <Icon name="refresh" size={17} />Retry</button>}
    </div>
  )
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem('uwm.theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return (
    <button className="iconbtn" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
      <Icon name={dark ? 'sun' : 'moon'} size={17} />
    </button>
  )
}

export function AppBar({ subtitle, right }: { subtitle: string; right?: ReactNode }) {
  return (
    <div className="appbar">
      <img className="uwm" src={LOGO} alt="UWM" />
      <div className="title"><b>UWM Fuel</b><span>{subtitle}</span></div>
      {right ?? <ThemeToggle />}
    </div>
  )
}

export function SubHead({ title, sub, onBack, right }: { title: string; sub?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="subhead">
      <button className="back" onClick={onBack} aria-label="Back"><Icon name="chevron" size={20} /></button>
      <div className="st"><b>{title}</b>{sub && <span>{sub}</span>}</div>
      {right}
    </div>
  )
}

export function Powered() {
  return <div className="powered">Built by <b>DUX Digitech</b></div>
}
