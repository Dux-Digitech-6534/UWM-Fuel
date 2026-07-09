import { useState } from 'react'
import { Icon } from '../icons'
import * as api from '../api'

// Reads a picked/captured file as base64 and uploads it via the JSON upload
// endpoint (works over the native HTTP bridge). Reports the resulting file_url.
export default function Attach({ label, value, onChange, required, capture }:
  { label: string; value: string; onChange: (fileUrl: string) => void; required?: boolean; capture?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')

  async function pick(file: File) {
    setErr(''); setBusy(true)
    try {
      const b64 = await toBase64(file)
      const res = await api.uploadFileB64(file.name, b64)
      onChange(res.file_url)
      setName(file.name)
    } catch (e: any) {
      setErr(e?.message || 'Upload failed')
    } finally { setBusy(false) }
  }

  const set = !!value
  return (
    <div>
      <label className={'attach' + (set ? ' set' : '') + (required && !set ? ' req-flag' : '')}>
        <Icon name={busy ? 'refresh' : set ? 'check' : 'file'} size={17} />
        <span className="fn">{busy ? 'Uploading…' : set ? (name || 'Attached') : label}</span>
        <input type="file" accept="image/*,application/pdf" {...(capture ? { capture: 'environment' } as any : {})}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f) }} />
      </label>
      {err && <div className="hint err">{err}</div>}
    </div>
  )
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',', 2)[1] || '')
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}
