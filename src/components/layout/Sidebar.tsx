import { NavLink } from 'react-router-dom'
import { LayoutDashboard, User, BarChart2 } from 'lucide-react'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Board' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/review', icon: BarChart2, label: 'Review' },
] as const

export default function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.logo}>K</div>
      <ul className={styles.nav}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
              aria-label={label}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
