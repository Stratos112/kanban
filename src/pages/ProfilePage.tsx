import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
      </header>

      <div className={styles.content}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Your identity</h2>
          <div className={styles.identity}>
            <div className={styles.avatarWrap}>
              <div
                className={styles.avatar}
                style={{ background: '#6366f1' }}
                aria-label="Avatar color"
              />
              {/* color picker — coming soon */}
            </div>
            <div className={styles.nameWrap}>
              <label className={styles.fieldLabel} htmlFor="display-name">
                Display name
              </label>
              <input
                id="display-name"
                className={styles.nameInput}
                type="text"
                defaultValue="Guest"
                placeholder="Your name"
              />
            </div>
          </div>
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
          {/* activity feed — coming soon */}
          <p className={styles.empty}>No activity yet.</p>
        </section>
      </div>
    </div>
  )
}
