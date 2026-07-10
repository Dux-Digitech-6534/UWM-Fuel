import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { Icon } from '../icons'
import { SubHead } from '../components/ui'
import { Field } from '../components/Field'
import LinkSelect from '../components/LinkSelect'
import Attach from '../components/Attach'
import { todayKolkata, inr } from '../format'
import * as api from '../api'

export default function StockForm() {
  const { boot, refreshBoot } = useAuth()
  const nav = useNavigate()
  const toast = useToast()

  const [f, setF] = useState({
    date_ffs: todayKolkata(),
    vendor_name: 'Sarjan Kisan Seva Kendra',
    item: 'Diesel',
    quantity_ffs: '',
    rateltr_ffs: '',
    bill_number: '',
    remarks: '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const [invoiceUrls, setInvoiceUrls] = useState<string[]>([])
  const [stationUrls, setStationUrls] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Prefill Rate/L from the vendor's most recent purchase of this fuel item.
  useEffect(() => {
    if (!f.vendor_name || !f.item) return
    let alive = true
    api.lastPurchaseRate(f.vendor_name, f.item)
      .then((r) => { if (alive && r && r.rate > 0) setF((p) => ({ ...p, rateltr_ffs: String(r.rate) })) })
      .catch(() => {})
    return () => { alive = false }
  }, [f.vendor_name, f.item])

  const qty = parseFloat(f.quantity_ffs) || 0
  const rate = parseFloat(f.rateltr_ffs) || 0
  const amount = Math.ceil(qty * rate)

  async function save() {
    setErr('')
    if (!f.vendor_name) return setErr('Select a vendor.')
    if (!f.item) return setErr('Select a fuel item.')
    if (qty <= 0) return setErr('Enter a quantity greater than 0.')
    if (rate <= 0) return setErr('Enter a rate greater than 0.')
    if (invoiceUrls.length === 0) return setErr('Invoice copy is required.')
    setBusy(true)
    try {
      const res = await api.createFuelStock({
        date_ffs: f.date_ffs,
        vendor_name: f.vendor_name,
        item: f.item,
        quantity_ffs: qty,
        rateltr_ffs: rate,
        warehouse: boot?.default_warehouse,
        company: boot?.company,
        bill_number: f.bill_number,
        upload_invoice__invoice_copy: invoiceUrls[0] || '',
        upload_fuel_station_proof__fuel_station_receipt: stationUrls[0] || '',
        all_files: [...invoiceUrls, ...stationUrls],
        remarks: f.remarks,
      })
      const refs = [res.purchase_receipt_ref, res.purchase_invoice_ref].filter(Boolean).join(' · ')
      toast({ msg: 'Fuel purchase saved', id: res.name + (refs ? '  →  ' + refs : '') })
      await refreshBoot()
      nav('/stock', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Could not save.')
    } finally { setBusy(false) }
  }

  return (
    <>
      <SubHead title="New Fuel Purchase" sub="Fuel for Stock" onBack={() => nav('/stock')} />
      <div className="body">
        {err && <div className="banner"><Icon name="alert" size={16} />{err}</div>}

        <div className="formcard accent">
          <div className="fsec"><Icon name="box" size={13} />Purchase details</div>
          <Field label="Date" req>
            <input className="ctrl" type="date" value={f.date_ffs} onChange={(e) => set('date_ffs')(e.target.value)} />
          </Field>
          <Field label="Vendor" req>
            <LinkSelect kind="supplier" value={f.vendor_name} onChange={set('vendor_name')} placeholder="Search vendor…" />
          </Field>
          <div className="pair">
            <Field label="Fuel item" req>
              <LinkSelect kind="fuel_item" value={f.item} onChange={set('item')} placeholder="Diesel / Petrol" />
            </Field>
            <Field label="Warehouse" req locked>
              <input className="ctrl readonly" value={boot?.default_warehouse || ''} readOnly />
            </Field>
          </div>
          <div className="pair">
            <Field label="Quantity (L)" req>
              <input className="ctrl numi" inputMode="decimal" type="number" step="0.01" value={f.quantity_ffs}
                onChange={(e) => set('quantity_ffs')(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Rate / L (₹)" req>
              <input className="ctrl numi" inputMode="decimal" type="number" step="0.01" value={f.rateltr_ffs}
                onChange={(e) => set('rateltr_ffs')(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          <div className="pair">
            <Field label="Amount" locked>
              <input className="ctrl calc" value={inr(amount)} readOnly />
            </Field>
            <Field label="Company" locked>
              <input className="ctrl readonly" value={boot?.company || ''} readOnly />
            </Field>
          </div>
        </div>

        <div className="formcard">
          <div className="fsec"><Icon name="receipt" size={13} />Proof & references</div>
          <Field label="Invoice copy" req>
            <Attach label="Upload invoice (required)" value={invoiceUrls} onChange={setInvoiceUrls} required />
          </Field>
          <Field label="Bill number">
            <input className="ctrl" value={f.bill_number} onChange={(e) => set('bill_number')(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Fuel station receipt">
            <Attach label="Upload fuel station proof" value={stationUrls} onChange={setStationUrls} />
          </Field>
          <Field label="Remarks">
            <textarea className="ctrl" value={f.remarks} onChange={(e) => set('remarks')(e.target.value)} placeholder="Optional notes" />
          </Field>
        </div>
      </div>

      <div className="savebar">
        <button className="btn ghost" onClick={() => nav('/stock')} aria-label="Cancel"><Icon name="close" size={19} /></button>
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : <><Icon name="check" size={18} />Save purchase</>}
        </button>
      </div>
    </>
  )
}
