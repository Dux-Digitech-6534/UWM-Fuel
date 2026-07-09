import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import { Loading, Powered } from './components/ui'
import { Icon } from './icons'
import BottomNav from './components/BottomNav'
import Login from './screens/Login'
import Home from './screens/Home'
import StockList from './screens/StockList'
import StockForm from './screens/StockForm'
import DistList from './screens/DistList'
import DistForm from './screens/DistForm'
import Detail from './screens/Detail'
import Profile from './screens/Profile'

export default function App() {
  const { status, boot } = useAuth()

  if (status === 'loading') return <div className="app"><Loading label="Starting UWM Fuel…" /></div>
  if (status === 'guest' || !boot) return <Login />
  if (!boot.can_use) return <NoPermission />

  return (
    <div className="app">
      <div className="body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/stock" element={<StockList />} />
          <Route path="/stock/new" element={boot.permissions.fuel_for_stock.create ? <StockForm /> : <Navigate to="/stock" replace />} />
          <Route path="/stock/view/:name" element={<Detail kind="stock" />} />
          <Route path="/dist" element={<DistList />} />
          <Route path="/dist/new" element={boot.permissions.fuel_for_distribution.create ? <DistForm /> : <Navigate to="/dist" replace />} />
          <Route path="/dist/view/:name" element={<Detail kind="dist" />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

function NoPermission() {
  const { logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="app">
      <div className="body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
        <div style={{ width: 66, height: 66, borderRadius: 20, background: 'var(--iris-tint)', color: 'var(--iris)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          <Icon name="lock" size={28} />
        </div>
        <div>
          <b style={{ fontSize: 17 }}>You're signed in</b>
          <p style={{ color: 'var(--fg-2)', fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
            but you don't have permission to use UWM Fuel. Please contact your administrator.
          </p>
        </div>
        <button className="btn primary" style={{ maxWidth: 220, margin: '0 auto' }} onClick={async () => { await logout(); nav('/', { replace: true }) }}>
          <Icon name="logout" size={17} />Logout
        </button>
        <Powered />
      </div>
    </div>
  )
}
