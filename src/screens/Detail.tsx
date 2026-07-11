import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../icons'
import { SubHead, Loading, ErrorState } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { inr, lt, shortDate } from '../format'
import * as api from '../api'

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Approved' ? 'ok' : status === 'Pending Approval' ? 'info' : 'pending'
  return <span className={'tag ' + cls}><span className="dot" />{status}</span>
}

export default function Detail({ kind }: { kind: 'stock' | 'dist' }) {
  const { name = '' } = useParams()
  const nav = useNavigate()
  const { boot } = useAuth()
  const toast = useToast()
  const [doc, setDoc] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')

  const load = () => {
    setErr(''); setDoc(null)
    const p = kind === 'stock' ? api.getFuelStock(name) : api.getFuelDistribution(name)
    return p.then(setDoc).catch((e) => setErr(e?.message || 'Could not load'))
  }
  useEffect(() => { load() }, [name, kind])

  const back = kind === 'stock' ? '/stock' : '/dist'
  const status: string = doc?.approval_status || 'Draft'
  const isApprover = !!boot?.is_fuel_final_approver

  async function doSubmit() {
    setBusy('submit'); setErr('')
    try { await api.submitFuelDistribution(name); toast({ msg: 'Submitted for approval', id: name }); await load() }
    catch (e: any) { setErr(e?.message || 'Could not submit') } finally { setBusy('') }
  }
  async function doApprove() {
    setBusy('approve'); setErr('')
    try {
      const r = await api.approveFuelDistribution(name)
      toast({ msg: 'Approved', id: name + (r.stock_entry_reference ? '  →  ' + r.stock_entry_reference : '') })
      await load()
    } catch (e: any) { setErr(e?.message || 'Could not approve') } finally { setBusy('') }
  }

  return (
    <>
      <SubHead title={name} sub={kind === 'stock' ? 'Fuel for Stock' : 'Fuel for Distribution'} onBack={() => nav(back)}
        right={kind === 'dist' && doc ? <StatusBadge status={status} /> : undefined} />
      <PullToRefresh onRefresh={() => load()}>
        {!doc && !err && <Loading />}
        {err && <div className="banner"><Icon name="alert" size={16} />{err}</div>}
        {!doc && err && <ErrorState message={err} onRetry={load} />}

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
              <Row k="Status" v={<StatusBadge status={status} />} />
              <Row k="Date" v={shortDate(doc.date)} />
              <Row k="Fuel type" v={doc.fuel_type} />
              <Row k="Warehouse" v={doc.warehouse} />
              <Row k="Total issued" v={lt(doc.total_fuel_issued) + ' L'} />
              <Row k="Stock Entry" v={doc.stock_entry_reference || '— (created on approval)'} />
              {status === 'Approved' && <Row k="Approved by" v={doc.approved_by || '—'} />}
              <Row k="Company" v={doc.company} />
            </div>
            <div className="sec-label">Vehicles</div>
            <div className="rows">
              {(doc.vehicle_details || []).map((r: any, i: number) => (
                <div key={i} className="row" style={{ cursor: 'default' }}>
                  <div className="kind out"><Icon name="truck" size={17} /></div>
                  <div className="mid"><b>{r.vehicle_details}</b>
                    <div className="sub"><span>Odo {r.odometer_reading || 0}</span>{r.upload_proof && <span>· proof ✓</span>}</div>
                  </div>
                  <div className="right"><span className="amt out">{lt(r.fuel_issued)} L</span></div>
                </div>
              ))}
            </div>
            {status === 'Pending Approval' && !isApprover && (
              <div className="banner info" style={{ marginTop: 16 }}><Icon name="lock" size={16} />Submitted — waiting for a Fuel Final Approver.</div>
            )}
            {status === 'Approved' && (
              <div className="banner info" style={{ marginTop: 16 }}><Icon name="check" size={16} />Approved. Stock has been issued and this entry is locked.</div>
            )}
          </>
        )}
      </PullToRefresh>

      {/* action bar — Fuel for Distribution only */}
      {doc && kind === 'dist' && status !== 'Approved' && (
        <div className="savebar">
          {status === 'Draft' && (
            <>
              <button className="btn ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={() => nav('/dist/edit/' + name)}>
                <Icon name="copy" size={17} />Edit
              </button>
              <button className="btn primary" onClick={doSubmit} disabled={!!busy}>
                {busy === 'submit' ? 'Submitting…' : <><Icon name="check" size={18} />Submit for approval</>}
              </button>
            </>
          )}
          {status === 'Pending Approval' && isApprover && (
            <>
              <button className="btn ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={() => nav('/dist/edit/' + name)}>
                <Icon name="copy" size={17} />Edit
              </button>
              <button className="btn primary" onClick={doApprove} disabled={!!busy}>
                {busy === 'approve' ? 'Approving…' : <><Icon name="check" size={18} />Approve</>}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="ir"><span className="k">{k}</span><span className="v">{v ?? '—'}</span></div>
}
