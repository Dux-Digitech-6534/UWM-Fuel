import { ReactNode } from 'react'
import { Icon } from '../icons'

export function Field({ label, req, locked, hint, hintErr, children }:
  { label: string; req?: boolean; locked?: boolean; hint?: string; hintErr?: boolean; children: ReactNode }) {
  return (
    <div className="field">
      <label>
        {label}
        {req && <span className="req">*</span>}
        {locked && <span className="lock"><Icon name="lock" size={12} /></span>}
      </label>
      {children}
      {hint && <div className={'hint' + (hintErr ? ' err' : '')}>{hint}</div>}
    </div>
  )
}

export function StatusTag({ docstatus }: { docstatus: number }) {
  if (docstatus === 2) return <span className="tag err"><span className="dot" />Cancelled</span>
  if (docstatus === 1) return <span className="tag ok"><span className="dot" />Submitted</span>
  return <span className="tag pending"><span className="dot" />Draft</span>
}
