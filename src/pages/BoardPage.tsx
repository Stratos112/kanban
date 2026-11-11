import TaskCard from '../components/board/TaskCard'
import styles from './BoardPage.module.css'
import type { TaskStatus } from '../lib/database.types'

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: 'backlog',     label: 'Backlog',      accent: 'var(--color-col-backlog)' },
  { key: 'ready',       label: 'Ready',        accent: 'var(--color-col-ready)' },
  { key: 'in_progress', label: 'In Progress',  accent: 'var(--color-col-in-progress)' },
  { key: 'in_review',   label: 'In Review',    accent: 'var(--color-col-in-review)' },
  { key: 'completed',   label: 'Completed',    accent: 'var(--color-col-completed)' },
]

// Placeholder cards — replaced by live data once features are wired up
const MOCK_TASKS = [
  { id: '1', refKey: 1,  type: 'task' as const, status: 'completed',   title: 'Set up Supabase schema and RLS policies',      priority: 'high'   as const, labels: [{ name: 'Backend',  color: '#38bdf8' }], assigneeColor: '#6366f1', assigneeName: 'Sky' },
  { id: '2', refKey: 2,  type: 'task' as const, status: 'in_progress', title: 'Build drag-and-drop board columns',             priority: 'high'   as const, labels: [{ name: 'Frontend', color: '#818cf8' }], assigneeColor: '#ec4899', assigneeName: 'Alex', dueDate: '2026-11-14' },
  { id: '3', refKey: 3,  type: 'task' as const, status: 'in_progress', title: 'Design task card component and dark theme',     priority: 'normal' as const, labels: [{ name: 'Design',   color: '#e879f9' }], assigneeColor: '#6366f1', assigneeName: 'Sky' },
  { id: '4', refKey: 4,  type: 'task' as const, status: 'ready',       title: 'Implement anonymous guest auth',                priority: 'high'   as const, labels: [{ name: 'Backend',  color: '#38bdf8' }], dueDate: '2026-11-13' },
  { id: '5', refKey: 5,  type: 'task' as const, status: 'ready',       title: 'Write unit tests for auth and type layers',     priority: 'normal' as const, labels: [{ name: 'Testing',  color: '#3fb950' }] },
  { id: '6', refKey: 6,  type: 'task' as const, status: 'ready',       title: 'Set up GitHub Actions CI pipeline',             priority: 'normal' as const, labels: [{ name: 'DevOps',   color: '#d29922' }] },
  { id: '7', refKey: 7,  type: 'task' as const, status: 'backlog',     title: 'Add label filtering to board header',           priority: 'low'    as const, labels: [{ name: 'Feature',  color: '#fb923c' }] },
  { id: '8', refKey: 8,  type: 'task' as const, status: 'backlog',     title: 'Mobile-responsive layout',                     priority: 'low'    as const, labels: [{ name: 'Design',   color: '#e879f9' }] },
  { id: '9', refKey: 9,  type: 'task' as const, status: 'in_review',   title: 'Deploy frontend to Vercel',                    priority: 'normal' as const, labels: [{ name: 'DevOps',   color: '#d29922' }], assigneeColor: '#ec4899', assigneeName: 'Alex' },
  { id: '10', refKey: 10, type: 'task' as const, status: 'backlog',    title: 'Review page charts with Recharts v3',           priority: 'normal' as const, labels: [{ name: 'Feature',  color: '#fb923c' }] },
]

const MOCK_CONTEXT = [
  { id: 'c1', refKey: 11, type: 'context' as const, status: 'context' as const, question: 'Should we support custom columns or keep them fixed?', answer: 'Fixed for now — reduces scope significantly.', priority: 'high' as const, labels: [{ name: 'Scope', color: '#fb923c' }] },
  { id: 'c2', refKey: 12, type: 'context' as const, status: 'context' as const, question: 'Do we need real-time updates via Supabase subscriptions?', answer: null, priority: 'normal' as const, labels: [{ name: 'Backend', color: '#38bdf8' }] },
]

export default function BoardPage() {
  const tasksInColumn = (status: TaskStatus) =>
    MOCK_TASKS.filter((t) => t.status === status)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Board</h1>
          <span className={styles.taskCount}>{MOCK_TASKS.length} tasks</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.filterBar}>
            <input className={styles.search} type="search" placeholder="Search tasks…" />
          </div>
          <button className={styles.addButton} type="button">+ New Task</button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const tasks = tasksInColumn(col.key)
          return (
            <section key={col.key} className={styles.column}>
              <div
                className={styles.columnHeader}
                style={{ '--col-accent': col.accent } as React.CSSProperties}
              >
                <span className={styles.columnLabel}>{col.label}</span>
                <span className={styles.columnCount}>{tasks.length}</span>
              </div>
              <div className={styles.columnBody}>
                {tasks.length === 0
                  ? <div className={styles.empty}>No tasks</div>
                  : tasks.map((t) => (
                      <TaskCard key={t.id} {...t} />
                    ))
                }
              </div>
            </section>
          )
        })}

        <section className={`${styles.column} ${styles.contextColumn}`}>
          <div
            className={styles.columnHeader}
            style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
          >
            <span className={styles.columnLabel}>Context</span>
            <span className={styles.columnCount}>{MOCK_CONTEXT.length}</span>
          </div>
          <div className={styles.columnBody}>
            {MOCK_CONTEXT.map((c) => (
              <TaskCard key={c.id} {...c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
