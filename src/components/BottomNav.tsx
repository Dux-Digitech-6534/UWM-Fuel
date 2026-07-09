import { useNavigate, useLocation } from 'react-router-dom'
import { Icon, IconName } from '../icons'

const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/home', icon: 'home', label: 'Home' },
  { to: '/stock', icon: 'download', label: 'Fuel Stock' },
  { to: '/dist', icon: 'truck', label: 'Fuel Distribution' },
  { to: '/profile', icon: 'user', label: 'Profile' },
]

export default function BottomNav() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  return (
    <div className="tabbar">
      {TABS.map((t) => (
        <button key={t.to} className={'tab' + (pathname.startsWith(t.to) ? ' active' : '')} onClick={() => nav(t.to)}>
          <Icon name={t.icon} size={21} /><span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
