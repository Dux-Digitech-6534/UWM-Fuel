import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../icons'
import { SubHead, Loading, ErrorState } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { inr, lt, shortDate } from '../format'
import * as api from '../api'

// Read-only detail. These documents create ledger entries (Purchase Receipt /
// Invoice / Stock Entry) on save, so the mobile app shows them as a record
// rather than allowing risky post-hoc edits.
export default function Detail({ kind }: { kind: 'stock' | 'dist' }) {
  const { name = '' } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [err, setErr] = useState('')

  const load = () => {
    setErr(''); setDoc(null)
    const p = kind === 'stock' ? api.getFuelStock(name) : api.getFuelDistribution(name)
    return p.then(setDoc).catch((e) => setErr(e?.message || 'Could not load'))
  }
  useEffect(() => { load() }, [name, kind])

  const back = kind === 'stock' ? '/stock' : '/dist'
  return (
    <>
      <SubHead title={name} sub={kind === 'stock' ? 'Fuel for Stock' : 'Fuel for Distribution'} onBack={() => nav(back)} />
      <PullToRefresh onRefresh={() => load()}>
        {!doc && !err && <Loading />}
        {err && <ErrorState message={err} onRetry={load} />}
        {doc && kind === 'stock' && (
          <div className="infolist">
            <Row k="Date" v={shortDate(doc.date_ffs)} />
            <Row k="Vendor" v={doc.vendor_name} />
            <Row k="Fuel item" v={doc.item} />
            <Row k="Quantity" v={lt(doc.quantity_ffs) + ' L'} />
            <Row k="Rate / L" v={inr(doc.rateltr_ffs)} />
            <Row k="Amount" v={inr(doc.amountffs || doc.aamountffs || (Number(doc.quantity_ffs) * Number(doc.rateltr_ffs)))} />
            <Row k="Warehouse" v={doc.warehouse} />
            <Row k="Bill number" v={doc.bill_number || '—'} />
            <Row k="Purchase Receipt" v={doc.purchase_receipt_ref || '—'} />
            <Row k="Purchase Invoice" v={doc.purchase_invoice_ref || '—'} />
            <Row k="Company" v={doc.company} />
          </div>
        )}
        {doc && kind === 'dist' && (
          <>
            <div className="infolist">
              <Row k="Date" v={shortDate(doc.date)} />
              <Row k="Fuel type" v={doc.fuel_type} />
              <Row k="Warehouse" v={doc.warehouse} />
              <Row k="Total issued" v={lt(doc.total_fuel_issued) + ' L'} />
              <Row k="Stock Entry" v={doc.stock_entry_reference || '—'} />
              <Row k="Company" v={doc.company} />
            </div>
            <div className="sec-label">Vehicles</div>
            <div className="rows">
              {(doc.vehicle_details || []).map((r: any, i: number) => (
                <div key={i} className="row" style={{ cursor: 'default' }}>
                  <div className="kind out"><Icon name="truck" size={17} /></div>
                  <div className="mid"><b>{r.vehicle_details}</b>
                    <div className="sub"><span>Odo {r.odometer_reading || 0}</span></div>
                  </div>
                  <div className="right"><span className="amt out">{lt(r.fuel_issued)} L</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </PullToRefresh>
    </>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="ir"><span className="k">{k}</span><span className="v">{v ?? '—'}</span></div>
}
