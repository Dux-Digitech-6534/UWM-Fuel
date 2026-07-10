import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { Icon } from '../icons'
import { SubHead } from '../components/ui'
import { Field } from '../components/Field'
import LinkSelect from '../components/LinkSelect'
import Attach from '../components/Attach'
import { todayKolkata, lt } from '../format'
import * as api from '../api'

type Row = { vehicle: string; odometer_reading: string; fuel_issued: string; proofs: string[] }
const emptyRow = (): Row => ({ vehicle: '', odometer_reading: '', fuel_issued: '', proofs: [] })

export default function DistForm() {
  const { boot, refreshBoot } = useAuth()
  const nav = useNavigate()
  const toast = useToast()

  const [date, setDate] = useState(todayKolkata())
  const [fuelType, setFuelType] = useState('Diesel')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')
  const [avail, setAvail] = useState<number | null>(boot?.stock_summary.available_stock ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!fuelType) return
    let alive = true
    api.getAvailableStock(fuelType, boot?.default_warehouse).then((r: any) => { if (alive) setAvail(r?.available_stock ?? null) }).catch(() => {})
    return () => { alive = false }
  }, [fuelType, boot?.default_warehouse])

  const total = rows.reduce((s, r) => s + (parseFloat(r.fuel_issued) || 0), 0)
  const over = avail != null && total > avail

  const setRow = (i: number, k: 'vehicle' | 'odometer_reading' | 'fuel_issued') => (v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const setRowProofs = (i: number) => (urls: string[]) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, proofs: urls } : r)))

  async function save() {
    setErr('')
    if (!fuelType) return setErr('Select a fuel type.')
    if (total <= 0) return setErr('Total fuel issued must be greater than 0.')
    if (over) return setErr(`Total (${lt(total)} L) exceeds available stock (${lt(avail)} L).`)
    if (rows.some((r) => !r.vehicle)) return setErr('Select a vehicle for every row.')
    const picked = rows.map((r) => r.vehicle).filter(Boolean)
    if (new Set(picked).size !== picked.length) return setErr('Same vehicle selected more than once. Each vehicle can be added only once.')
    setBusy(true)
    try {
      const allFiles = [...attachmentUrls, ...rows.flatMap((r) => r.proofs)]
      const res = await api.createFuelDistribution({
        date, fuel_type: fuelType,
        warehouse: boot?.default_warehouse, company: boot?.company,
        attachment: attachmentUrls[0] || '', remarks,
        all_files: allFiles,
        vehicle_details: rows.map((r) => ({
          vehicle: r.vehicle,
          odometer_reading: parseFloat(r.odometer_reading) || 0,
          fuel_issued: parseFloat(r.fuel_issued) || 0,
          upload_proof: r.proofs[0] || '',
        })),
      })
      toast({ msg: 'Distribution saved', id: res.name + (res.stock_entry_reference ? '  →  ' + res.stock_entry_reference : '') })
      await refreshBoot()
      nav('/dist', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Could not save.')
    } finally { setBusy(false) }
  }

  return (
    <>
      <SubHead title="New Distribution" sub="Fuel for Distribution" onBack={() => nav('/dist')} />
      <div className="body">
        {err && <div className="banner"><Icon name="alert" size={16} />{err}</div>}

        <div className="formcard accent">
          <div className="fsec"><Icon name="box" size={13} />Stock details</div>
          <div className="pair">
            <Field label="Date" req>
              <input className="ctrl" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Fuel type" req>
              <LinkSelect kind="fuel_item" value={fuelType} onChange={setFuelType} placeholder="Diesel / Petrol" />
            </Field>
          </div>
          <Field label="Warehouse" req locked>
            <input className="ctrl readonly" value={boot?.default_warehouse || ''} readOnly />
          </Field>
          <div className="pair">
            <Field label="Available stock" locked>
              <input className="ctrl calc" value={avail == null ? '—' : lt(avail) + ' L'} readOnly />
            </Field>
            <Field label="Company" locked>
              <input className="ctrl readonly" value={boot?.company || ''} readOnly />
            </Field>
          </div>
        </div>

        <div className="formcard">
          <div className="fsec"><Icon name="truck" size={13} />Distribution to vehicles</div>
          {rows.map((r, i) => (
            <div className="vrow" key={i}>
              <div className="vh">
                <b><span className="n">{i + 1}</span>Vehicle</b>
                {rows.length > 1 && <button className="del" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}><Icon name="close" size={15} /></button>}
              </div>
              <Field label="Vehicle" req>
                <LinkSelect kind="vehicle" value={r.vehicle} onChange={setRow(i, 'vehicle')} placeholder="Search vehicle…"
                  disabledValues={rows.filter((_, idx) => idx !== i).map((x) => x.vehicle).filter(Boolean)} />
              </Field>
              <div className="pair">
                <Field label="Odometer (km)">
                  <input className="ctrl numi" inputMode="numeric" type="number" value={r.odometer_reading}
                    onChange={(e) => setRow(i, 'odometer_reading')(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Fuel issued (L)" req>
                  <input className="ctrl numi" inputMode="decimal" type="number" step="0.01" value={r.fuel_issued}
                    onChange={(e) => setRow(i, 'fuel_issued')(e.target.value)} placeholder="0.00" />
                </Field>
              </div>
              <Attach label="Attach proof (one or more)…" value={r.proofs} onChange={setRowProofs(i)} />
            </div>
          ))}
          <button className="addrow" onClick={() => setRows((p) => [...p, emptyRow()])}>
            <Icon name="plus" size={16} />Add vehicle
          </button>

          <div className={'total-strip' + (over ? ' over' : '')}>
            <span className="lbl">Total fuel issued</span>
            <span className="v">{lt(total)} L</span>
          </div>
          {over && <div className="hint err">Exceeds available stock ({lt(avail)} L).</div>}
        </div>

        <div className="formcard">
          <div className="fsec"><Icon name="receipt" size={13} />Attachment & notes</div>
          <Field label="Main attachment">
            <Attach label="Attach document(s)…" value={attachmentUrls} onChange={setAttachmentUrls} />
          </Field>
          <Field label="Remarks">
            <textarea className="ctrl" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
          </Field>
        </div>
      </div>

      <div className="savebar">
        <button className="btn ghost" onClick={() => nav('/dist')} aria-label="Cancel"><Icon name="close" size={19} /></button>
        <button className="btn primary" onClick={save} disabled={busy || total <= 0 || over}>
          {busy ? 'Saving…' : <><Icon name="check" size={18} />Save distribution</>}
        </button>
      </div>
    </>
  )
}
