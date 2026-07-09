import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { Loading, EmptyState, ErrorState } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { inr, lt, shortDate } from '../format'
import { LOGO } from '../config'
import * as api from '../api'

export default function StockList() {
  const { boot } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const canCreate = boot?.permissions.fuel_for_stock.create

  const load = useCallback(async (txt = '') => {
    setErr(''); setRows(null)
    try { setRows(await api.listFuelStock(30, 0, txt)) }
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
        <div className="title"><b>Fuel for Stock</b><span>Purchases · {boot?.company}</span></div>
        {canCreate && <button className="iconbtn" onClick={() => nav('/stock/new')} aria-label="New"><Icon name="plus" size={18} /></button>}
      </div>
      <PullToRefresh onRefresh={() => load(q)}>
        <div className="searchbar"><Icon name="search" size={17} />
          <input placeholder="Search vendor, fuel, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {rows === null && <Loading />}
        {rows !== null && err && <ErrorState message={err} onRetry={() => load(q)} />}
        {rows !== null && !err && rows.length === 0 && (
          <EmptyState icon="download" title="No fuel purchases" sub={canCreate ? 'Tap + to add one.' : undefined} />
        )}
        {rows !== null && !err && rows.length > 0 && (
          <div className="rows">
            {rows.map((r) => (
              <button key={r.name} className="row" onClick={() => nav(`/stock/view/${r.name}`)}>
                <div className="kind in"><Icon name="download" size={17} /></div>
                <div className="mid">
                  <b>{r.vendor || r.name}</b>
                  <div className="sub"><span>{r.name}</span>·<span>{r.item}</span>·<span>{lt(r.quantity)} L</span>·<span>{shortDate(r.date)}</span></div>
                </div>
                <div className="right">
                  <span className="amt in">{inr(r.amount)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PullToRefresh>
    </>
  )
}
