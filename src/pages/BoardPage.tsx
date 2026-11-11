import { useState } from 'react'
import TaskCard from '../components/board/TaskCard'
import NewTaskModal, { type NewTaskPayload } from '../components/board/NewTaskModal'
import styles from './BoardPage.module.css'
import type { TaskPriority, TaskStatus } from '../lib/database.types'

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: 'backlog',     label: 'Backlog',     accent: 'var(--color-col-backlog)' },
  { key: 'ready',       label: 'Ready',       accent: 'var(--color-col-ready)' },
  { key: 'in_progress', label: 'In Progress', accent: 'var(--color-col-in-progress)' },
  { key: 'in_review',   label: 'In Review',   accent: 'var(--color-col-in-review)' },
  { key: 'completed',   label: 'Completed',   accent: 'var(--color-col-completed)' },
]

interface LocalTask {
  id: string
  refKey: number
  type: 'task'
  status: Exclude<TaskStatus, 'context'>
  title: string
  priority: TaskPriority
  dueDate?: string
  labels: { name: string }[]
}

let nextRefKey = 1

export default function BoardPage() {
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  function handleCreate(payload: NewTaskPayload) {
    const task: LocalTask = {
      id: crypto.randomUUID(),
      refKey: nextRefKey++,
      type: 'task',
      status: payload.status,
      title: payload.title,
      priority: payload.priority,
      dueDate: payload.dueDate || undefined,
      labels: payload.labels,
    }
    setTasks((prev) => [...prev, task])
    setModalOpen(false)
  }

  const tasksInColumn = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Board</h1>
          <span className={styles.taskCount}>{tasks.length} tasks</span>
        </div>
        <div className={styles.headerRight}>
          <input className={styles.search} type="search" placeholder="Search tasks…" />
          <button
            className={styles.addButton}
            type="button"
            onClick={() => setModalOpen(true)}
          >
            + New Task
          </button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const colTasks = tasksInColumn(col.key)
          const css = { '--col-accent': col.accent } as React.CSSProperties
          return (
            <section
              key={col.key}
              className={[
                styles.column,
                col.key === 'in_review' && styles.inReviewColumn,
                col.key === 'completed' && styles.completedColumn,
              ].filter(Boolean).join(' ')}
              style={css}
            >
              <div className={styles.columnHeader} style={css}>
                <span className={styles.columnLabel}>{col.label}</span>
                <span className={styles.columnCount}>{colTasks.length}</span>
              </div>
              <div className={styles.columnBody}>
                {colTasks.length === 0
                  ? <div className={styles.empty}>No tasks</div>
                  : colTasks.map((t) => <TaskCard key={t.id} {...t} />)
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
            <span className={styles.columnCount}>0</span>
          </div>
          <div className={styles.columnBody}>
            <div className={styles.empty}>No context cards</div>
          </div>
        </section>
      </div>

      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
