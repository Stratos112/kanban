import { NavLink } from 'react-router-dom'
import { LayoutDashboard, User, BarChart2 } from 'lucide-react'
import styles from './Sidebar.module.css'

const NAV_MAIN = [
  { to: '/', icon: LayoutDashboard, label: 'Board' },
  { to: '/review', icon: BarChart2, label: 'Review' },
] as const

export default function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.logo}>K</div>

      <NavLink
        to="/profile"
        end
        className={({ isActive }) =>
          `${styles.profileLink} ${isActive ? styles.profileActive : ''}`
        }
        aria-label="Profile"
      >
        <User size={18} strokeWidth={1.75} />
        <span className={styles.label}>Profile</span>
      </NavLink>

      <div className={styles.divider} />

      <ul className={styles.nav}>
        {NAV_MAIN.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
              aria-label={label}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
