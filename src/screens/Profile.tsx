import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { AppBar, Powered } from '../components/ui'

const APP_VERSION = '2.2.0'

export default function Profile() {
  const { boot, logout } = useAuth()
  const nav = useNavigate()
  if (!boot) return null
  const initials = (boot.full_name || boot.user).split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <AppBar subtitle="Profile" />
      <div className="body">
        <div className="profile-card">
          <div className="av">{initials}</div>
          <div className="nm">{boot.full_name}</div>
          <div className="em">{boot.user}</div>
          {boot.roles.length > 0 && (
            <div className="role-pills">{boot.roles.map((r) => <span key={r}>{r}</span>)}</div>
          )}
        </div>

        <div className="infolist">
          <div className="ir"><span className="k">Company</span><span className="v">{boot.company}</span></div>
          <div className="ir"><span className="k">Default warehouse</span><span className="v">{boot.default_warehouse}</span></div>
          <div className="ir"><span className="k">Fuel Stock access</span><span className="v">{permLabel(boot.permissions.fuel_for_stock)}</span></div>
          <div className="ir"><span className="k">Distribution access</span><span className="v">{permLabel(boot.permissions.fuel_for_distribution)}</span></div>
          <div className="ir"><span className="k">App version</span><span className="v">{APP_VERSION}</span></div>
        </div>

        <button className="btn primary wide" style={{ marginTop: 18 }}
          onClick={async () => { await logout(); nav('/', { replace: true }) }}>
          <Icon name="logout" size={17} />Logout
        </button>
        <Powered />
      </div>
    </>
  )
}

function permLabel(p: { read: boolean; create: boolean; write: boolean }) {
  if (p.create && p.write) return 'Create & edit'
  if (p.create) return 'Create'
  if (p.read) return 'View only'
  return 'No access'
}
