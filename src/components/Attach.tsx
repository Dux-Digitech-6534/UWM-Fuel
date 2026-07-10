import { useState } from 'react'
import { Icon } from '../icons'
import * as api from '../api'

// Multi-file attach. Lets the user pick MULTIPLE files from the gallery, files,
// or camera (no forced capture), uploads each as a private file, and keeps the
// list of file_urls. Used for every attachment in the app.
export default function Attach({ label, value, onChange, required }:
  { label: string; value: string[]; onChange: (urls: string[]) => void; required?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function pick(files: FileList) {
    setErr(''); setBusy(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const b64 = await toBase64(file)
        const res = await api.uploadFileB64(file.name, b64)
        uploaded.push(res.file_url)
      }
      onChange([...value, ...uploaded])
    } catch (e: any) {
      setErr(e?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {value.map((u, i) => (
        <div key={i} className="attach set" style={{ marginBottom: 6 }}>
          <Icon name="check" size={16} />
          <span className="fn">{decodeURIComponent(u.split('/').pop() || 'Attached')}</span>
          <button type="button" className="attach-del" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove">
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
      <label className={'attach' + (required && value.length === 0 ? ' req-flag' : '')}>
        <Icon name={busy ? 'refresh' : value.length ? 'plus' : 'file'} size={17} />
        <span className="fn">{busy ? 'Uploading…' : value.length ? 'Add more…' : label}</span>
        <input type="file" accept="image/*,application/pdf" multiple
          onChange={(e) => { if (e.target.files && e.target.files.length) pick(e.target.files); e.currentTarget.value = '' }} />
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
