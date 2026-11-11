import TaskCard from '../components/board/TaskCard'
import styles from './BoardPage.module.css'
import type { TaskStatus } from '../lib/database.types'

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: 'backlog',     label: 'Backlog',     accent: 'var(--color-col-backlog)' },
  { key: 'ready',       label: 'Ready',       accent: 'var(--color-col-ready)' },
  { key: 'in_progress', label: 'In Progress', accent: 'var(--color-col-in-progress)' },
  { key: 'in_review',   label: 'In Review',   accent: 'var(--color-col-in-review)' },
  { key: 'completed',   label: 'Completed',   accent: 'var(--color-col-completed)' },
]

// Label colors must not reuse any column or priority color
const LABEL_COLORS = {
  Backend:  '#0ea5e9',  // sky  — matches Ready column intentionally (backend enables it)
  Frontend: '#7c3aed',  // violet
  Design:   '#d946ef',  // fuchsia
  Testing:  '#10b981',  // emerald
  DevOps:   '#94a3b8',  // slate
  Feature:  '#f59e0b',  // amber (accent)
  Scope:    '#f43f5e',  // rose
}

const MOCK_TASKS = [
  { id: '1',  refKey: 1,  type: 'task' as const, status: 'completed'   as const, title: 'Set up Supabase schema and RLS policies',       priority: 'high'   as const, labels: [{ name: 'Backend',  color: LABEL_COLORS.Backend  }], assigneeColor: '#7c3aed', assigneeName: 'Sky' },
  { id: '2',  refKey: 2,  type: 'task' as const, status: 'in_progress' as const, title: 'Build drag-and-drop board columns',              priority: 'high'   as const, labels: [{ name: 'Frontend', color: LABEL_COLORS.Frontend }], assigneeColor: '#d946ef', assigneeName: 'Alex', dueDate: '2026-11-14' },
  { id: '3',  refKey: 3,  type: 'task' as const, status: 'in_progress' as const, title: 'Design task card component and dark theme',      priority: 'normal' as const, labels: [{ name: 'Design',   color: LABEL_COLORS.Design   }], assigneeColor: '#7c3aed', assigneeName: 'Sky' },
  { id: '4',  refKey: 4,  type: 'task' as const, status: 'ready'       as const, title: 'Implement anonymous guest auth',                 priority: 'high'   as const, labels: [{ name: 'Backend',  color: LABEL_COLORS.Backend  }], dueDate: '2026-11-13' },
  { id: '5',  refKey: 5,  type: 'task' as const, status: 'ready'       as const, title: 'Write unit tests for auth and type layers',      priority: 'normal' as const, labels: [{ name: 'Testing',  color: LABEL_COLORS.Testing  }] },
  { id: '6',  refKey: 6,  type: 'task' as const, status: 'ready'       as const, title: 'Set up GitHub Actions CI pipeline',              priority: 'normal' as const, labels: [{ name: 'DevOps',   color: LABEL_COLORS.DevOps   }] },
  { id: '7',  refKey: 7,  type: 'task' as const, status: 'backlog'     as const, title: 'Add label filtering to board header',            priority: 'low'    as const, labels: [{ name: 'Feature',  color: LABEL_COLORS.Feature  }] },
  { id: '8',  refKey: 8,  type: 'task' as const, status: 'backlog'     as const, title: 'Mobile-responsive layout',                      priority: 'low'    as const, labels: [{ name: 'Design',   color: LABEL_COLORS.Design   }] },
  { id: '9',  refKey: 9,  type: 'task' as const, status: 'in_review'   as const, title: 'Deploy frontend to Vercel',                     priority: 'normal' as const, labels: [{ name: 'DevOps',   color: LABEL_COLORS.DevOps   }], assigneeColor: '#d946ef', assigneeName: 'Alex' },
  { id: '10', refKey: 10, type: 'task' as const, status: 'backlog'     as const, title: 'Review page charts with Recharts v3',            priority: 'normal' as const, labels: [{ name: 'Feature',  color: LABEL_COLORS.Feature  }] },
]

const MOCK_CONTEXT = [
  { id: 'c1', refKey: 11, type: 'context' as const, status: 'context' as const, question: 'Should we support custom columns or keep them fixed?', answer: 'Fixed for now — reduces scope significantly.', priority: 'high' as const, labels: [{ name: 'Scope', color: LABEL_COLORS.Scope }] },
  { id: 'c2', refKey: 12, type: 'context' as const, status: 'context' as const, question: 'Do we need real-time updates via Supabase subscriptions?', answer: null, priority: 'normal' as const, labels: [{ name: 'Backend', color: LABEL_COLORS.Backend }] },
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
          <input className={styles.search} type="search" placeholder="Search tasks…" />
          <button className={styles.addButton} type="button">+ New Task</button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const tasks = tasksInColumn(col.key)
          const css = { '--col-accent': col.accent } as React.CSSProperties
          return (
            <section
              key={col.key}
              className={[
                styles.column,
                col.key === 'in_review'  && styles.inReviewColumn,
                col.key === 'completed'  && styles.completedColumn,
              ].filter(Boolean).join(' ')}
              style={css}
            >
              <div className={styles.columnHeader} style={css}>
                <span className={styles.columnLabel}>{col.label}</span>
                <span className={styles.columnCount}>{tasks.length}</span>
              </div>
              <div className={styles.columnBody}>
                {tasks.length === 0
                  ? <div className={styles.empty}>No tasks</div>
                  : tasks.map((t) => <TaskCard key={t.id} {...t} />)
                }
              </div>
            </section>
          )
        })}

        <section
          className={`${styles.column} ${styles.contextColumn}`}
          style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
        >
          <div
            className={styles.columnHeader}
            style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
          >
            <span className={styles.columnLabel}>Context</span>
            <span className={styles.columnCount}>{MOCK_CONTEXT.length}</span>
          </div>
          <div className={styles.columnBody}>
            {MOCK_CONTEXT.map((c) => <TaskCard key={c.id} {...c} />)}
          </div>
        </section>
      </div>
    </div>
  )
}
