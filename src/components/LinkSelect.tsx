import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import * as api from '../api'

type Opt = { value: string; label: string }

export default function LinkSelect({ kind, value, onChange, placeholder, disabledValues = [] }:
  { kind: string; value: string; onChange: (v: string) => void; placeholder: string; disabledValues?: string[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      try { setOpts(await api.searchLink(kind, q, 25)) } catch { setOpts([]) } finally { setLoading(false) }
    }, 220)
    return () => window.clearTimeout(timer.current)
  }, [q, open, kind])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="lslot" ref={box}>
      <button type="button" className="ctrl picked" onClick={() => { setOpen((o) => !o); setQ('') }}>
        <span style={{ color: value ? 'var(--fg-1)' : 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <Icon name="chevrondown" size={17} />
      </button>
      {open && (
        <div className="menu">
          <input className="q" autoFocus placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {loading && <div className="none">Searching…</div>}
          {!loading && opts.length === 0 && <div className="none">No matches</div>}
          {!loading && opts.map((o) => {
            const taken = disabledValues.includes(o.value) && o.value !== value
            return (
              <div key={o.value}
                className={'opt' + (o.value === value ? ' active' : '') + (taken ? ' disabled' : '')}
                onClick={() => { if (taken) return; onChange(o.value); setOpen(false) }}>
                {o.label}
                {taken ? <small>already selected</small> : (o.label !== o.value && <small>{o.value}</small>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
