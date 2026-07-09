import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { Icon } from '../icons'
import { AppBar, Powered, EmptyState } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { lt, inr, shortDate } from '../format'

export default function Home() {
  const { boot, refreshBoot } = useAuth()
  const nav = useNavigate()
  const toast = useToast()

  useEffect(() => {
    try {
      if (sessionStorage.getItem('uwm.justLoggedIn') === '1') {
        sessionStorage.removeItem('uwm.justLoggedIn')
        toast({ msg: 'Signed in securely', id: boot?.full_name })
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!boot) return null
  const s = boot.stock_summary
  const canStock = boot.permissions.fuel_for_stock
  const canDist = boot.permissions.fuel_for_distribution

  return (
    <>
      <AppBar subtitle={boot.company} />
      <PullToRefresh onRefresh={refreshBoot}>
        <div className="hero">
          <div className="eyebrow"><Icon name="gauge" size={13} />Available diesel stock</div>
          <div className="big">
            <span className="val">{s.available_stock == null ? '—' : lt(s.available_stock)}</span>
            <span className="unit">L</span>
          </div>
          <div className="gauge-meta">
            <span><Icon name="building" size={11} /> {s.warehouse}</span>
            <button className="link" style={{ border: 'none', background: 'none', color: 'var(--iris)', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} onClick={refreshBoot}>
              <Icon name="refresh" size={12} />as of {s.as_of}
            </button>
          </div>
        </div>

        <div className="tiles">
          <button className="tile in" disabled={!canStock.read} onClick={() => nav('/stock')}>
            <div className="ic"><Icon name="download" size={20} /></div>
            <b>Fuel for Stock</b>
            <span>Purchases in · vendor invoices</span>
            <div className="arrow"><Icon name="chevron" size={16} flip /></div>
          </button>
          <button className="tile out" disabled={!canDist.read} onClick={() => nav('/dist')}>
            <div className="ic"><Icon name="truck" size={20} /></div>
            <b>Fuel for Distribution</b>
            <span>Issue to vehicles · stock out</span>
            <div className="arrow"><Icon name="chevron" size={16} flip /></div>
          </button>
        </div>

        <div className="sec-label">Recent activity</div>
        {boot.recent_activity.length === 0
          ? <EmptyState icon="layers" title="No activity yet" sub="Fuel entries will appear here." />
          : (
            <div className="rows">
              {boot.recent_activity.map((r) => (
                <button key={r.doctype + r.name} className="row"
                  onClick={() => nav(r.kind === 'in' ? `/stock/view/${r.name}` : `/dist/view/${r.name}`)}>
                  <div className={'kind ' + (r.kind === 'in' ? 'in' : 'out')}>
                    <Icon name={r.kind === 'in' ? 'download' : 'truck'} size={17} />
                  </div>
                  <div className="mid">
                    <b>{r.title}</b>
                    <div className="sub"><span>{r.name}</span>·<span>{r.fuel || '—'}</span>·<span>{shortDate(r.modified)}</span></div>
                  </div>
                  <div className="right">
                    <span className={'amt ' + (r.kind === 'in' ? 'in' : 'out')}>
                      {r.kind === 'in' ? inr(r.amount) : lt(r.litres) + ' L'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        <Powered />
      </PullToRefresh>
    </>
  )
}
