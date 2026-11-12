import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './ProfilePage.module.css'

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

export default function ProfilePage() {
  const { profile, userId, loading, setProfile, hideOthers, setHideOthers } = useAuth()
  const [name, setName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  useEffect(() => {
    if (!pickerOpen) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        avatarRef.current && !avatarRef.current.contains(target)
      ) {
        setPickerOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  async function saveName() {
    if (!userId || !name.trim() || name === profile?.display_name) return
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  }

  async function pickColor(color: string) {
    if (!userId || !profile) return
    setProfile({ ...profile, avatar_color: color })
    setPickerOpen(false)
    await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId)
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
              <div className={styles.avatarWrap}>
                <div
                  ref={avatarRef}
                  className={styles.avatar}
                  style={{ background: profile?.avatar_color ?? '#6366f1' }}
                  aria-label="Pick avatar color"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (pickerOpen) { setPickerOpen(false); return }
                    const rect = avatarRef.current?.getBoundingClientRect()
                    if (rect) setPickerPos({ top: rect.bottom + 10, left: rect.left + rect.width / 2 })
                    setPickerOpen(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const rect = avatarRef.current?.getBoundingClientRect()
                      if (rect) setPickerPos({ top: rect.bottom + 10, left: rect.left + rect.width / 2 })
                      setPickerOpen((o) => !o)
                    }
                  }}
                />
                {pickerOpen && pickerPos && (
                  <div
                    ref={pickerRef}
                    className={styles.picker}
                    style={{ top: pickerPos.top, left: pickerPos.left }}
                  >
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        className={styles.swatch}
                        style={{ background: c }}
                        aria-label={c}
                        aria-pressed={profile?.avatar_color === c}
                        onClick={() => pickColor(c)}
                      >
                        {profile?.avatar_color === c && <span className={styles.swatchCheck}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

        <section className={`${styles.focusCard} ${hideOthers ? styles.focusOn : ''}`}>
          <div className={styles.focusRow}>
            <div className={styles.focusText}>
              <span className={styles.focusTitle}>Focus mode</span>
              <span className={styles.focusDesc}>
                Hide tasks assigned to other team members. Unassigned tasks and your own tasks always stay visible.
              </span>
            </div>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={hideOthers}
                onChange={(e) => setHideOthers(e.target.checked)}
              />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
            </label>
          </div>
          <span className={`${styles.focusStatus} ${hideOthers ? styles.on : styles.off}`}>
            {hideOthers ? 'On — showing your tasks only' : 'Off — showing all tasks'}
          </span>
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
