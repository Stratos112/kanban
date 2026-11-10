import styles from './BoardPage.module.css'

const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'ready', label: 'Ready' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'completed', label: 'Completed' },
] as const

export default function BoardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Board</h1>
          <span className={styles.taskCount}>0 tasks</span>
        </div>
        <div className={styles.headerRight}>
          {/* filter bar — coming soon */}
          <button className={styles.addButton} type="button">
            + New Task
          </button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((col) => (
          <section key={col.key} className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel}>{col.label}</span>
              <span className={styles.columnCount}>0</span>
            </div>
            <div className={styles.columnBody}>
              {/* task cards rendered here */}
              <div className={styles.empty}>No tasks</div>
            </div>
          </section>
        ))}

        <section className={`${styles.column} ${styles.contextColumn}`}>
          <div className={styles.columnHeader}>
            <span className={styles.columnLabel}>Context</span>
            <span className={styles.columnCount}>0</span>
          </div>
          <div className={styles.columnBody}>
            {/* context cards rendered here */}
            <div className={styles.empty}>No context cards</div>
          </div>
        </section>
      </div>
    </div>
  )
}
