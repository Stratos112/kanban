import styles from './ReviewPage.module.css'

export default function ReviewPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Review</h1>
      </header>

      <div className={styles.content}>
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Status snapshot</h2>
            <div className={styles.chartPlaceholder}>
              {/* Donut chart — coming soon */}
              <span className={styles.chartLabel}>Tasks by column</span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Completion over time</h2>
            <div className={styles.chartPlaceholder}>
              {/* Area chart — coming soon */}
              <span className={styles.chartLabel}>Completed per day</span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Work by assignee</h2>
            <div className={styles.chartPlaceholder}>
              {/* Horizontal bar — coming soon */}
              <span className={styles.chartLabel}>Open vs. completed</span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Label breakdown</h2>
            <div className={styles.chartPlaceholder}>
              {/* Bar chart — coming soon */}
              <span className={styles.chartLabel}>Tasks per label</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
