import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { profile, userId, loading } = useAuth()
  const [name, setName] = useState('')

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  async function saveName() {
    if (!userId || !name.trim() || name === profile?.display_name) return
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
      </header>

      <div className={styles.content}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Your identity</h2>
          {loading ? (
            <p className={styles.empty}>Loading…</p>
          ) : (
            <div className={styles.identity}>
              <div
                className={styles.avatar}
                style={{ background: profile?.avatar_color ?? '#6366f1' }}
                aria-label="Avatar color"
              />
              <div className={styles.nameWrap}>
                <label className={styles.fieldLabel} htmlFor="display-name">
                  Display name
                </label>
                <input
                  id="display-name"
                  className={styles.nameInput}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder="Your name"
                />
              </div>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Stats</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>0</span>
              <span className={styles.statLabel}>Assigned</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>0</span>
              <span className={styles.statLabel}>Completed</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>0</span>
              <span className={styles.statLabel}>Questions asked</span>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Recent activity</h2>
          <p className={styles.empty}>No activity yet.</p>
        </section>
      </div>
    </div>
  )
}
