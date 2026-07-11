import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { Loading, EmptyState, ErrorState } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { lt, shortDate } from '../format'
import { LOGO } from '../config'
import * as api from '../api'

export default function DistList() {
  const { boot } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const canCreate = boot?.permissions.fuel_for_distribution.create

  const load = useCallback(async (txt = '') => {
    setErr(''); setRows(null)
    try { setRows(await api.listFuelDistribution(30, 0, txt)) }
    catch (e: any) { setErr(e?.message || 'Could not load'); setRows([]) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = window.setTimeout(() => load(q), 300)
    return () => window.clearTimeout(t)
  }, [q, load])

  return (
    <>
      <div className="appbar">
        <img className="uwm" src={LOGO} alt="UWM" />
        <div className="title"><b>Fuel for Distribution</b><span>Issued to vehicles · {boot?.company}</span></div>
        {canCreate && <button className="iconbtn" onClick={() => nav('/dist/new')} aria-label="New"><Icon name="plus" size={18} /></button>}
      </div>
      <PullToRefresh onRefresh={() => load(q)}>
        <div className="searchbar"><Icon name="search" size={17} />
          <input placeholder="Search vehicle, fuel, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {rows === null && <Loading />}
        {rows !== null && err && <ErrorState message={err} onRetry={() => load(q)} />}
        {rows !== null && !err && rows.length === 0 && (
          <EmptyState icon="truck" title="No distributions" sub={canCreate ? 'Tap + to issue fuel.' : undefined} />
        )}
        {rows !== null && !err && rows.length > 0 && (
          <div className="rows">
            {rows.map((r) => (
              <button key={r.name} className="row" onClick={() => nav(`/dist/view/${r.name}`)}>
                <div className="kind out"><Icon name="truck" size={17} /></div>
                <div className="mid">
                  <b>{r.name}</b>
                  <div className="sub"><span>{r.fuel_type}</span>·<span>{shortDate(r.date)}</span></div>
                </div>
                <div className="right">
                  <span className="amt out">{lt(r.total_issued)} L</span>
                  {(() => {
                    const st = r.approval_status || 'Draft'
                    const cls = st === 'Approved' ? 'ok' : st === 'Pending Approval' ? 'info' : 'pending'
                    return <span className={'tag ' + cls}><span className="dot" />{st === 'Pending Approval' ? 'Pending' : st}</span>
                  })()}
                </div>
              </button>
            ))}
          </div>
        )}
      </PullToRefresh>
    </>
  )
}
