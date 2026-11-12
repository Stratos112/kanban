import { NavLink, useParams } from 'react-router-dom'
import { LayoutDashboard, User, SlidersHorizontal, BarChart2 } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  const { slug } = useParams<{ slug: string }>()
  const base = `/board/${slug}`
  const { profile } = useAuth()

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.logo}>K</div>

      <NavLink
        to={`${base}/profile`}
        className={({ isActive }) =>
          `${styles.profileLink} ${isActive ? styles.profileActive : ''}`
        }
        aria-label="Profile"
      >
        {profile
          ? <div className={styles.avatarDot} style={{ background: profile.avatar_color }} />
          : <User size={18} strokeWidth={1.75} />
        }
        <span className={styles.label}>Profile</span>
      </NavLink>

      <NavLink
        to={`${base}/settings`}
        className={({ isActive }) =>
          `${styles.profileLink} ${isActive ? styles.profileActive : ''}`
        }
        aria-label="Settings"
      >
        <SlidersHorizontal size={18} strokeWidth={1.75} />
        <span className={styles.label}>Labels</span>
      </NavLink>

      <div className={styles.divider} />

      <ul className={styles.nav}>
        {[
          { to: base,           icon: LayoutDashboard, label: 'Board', end: true },
          { to: `${base}/review`, icon: BarChart2,       label: 'Review', end: false },
        ].map(({ to, icon: Icon, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
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
