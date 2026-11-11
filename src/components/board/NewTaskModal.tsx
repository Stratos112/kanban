import { useEffect, useState } from 'react'
import type { TaskPriority, TaskStatus } from '../../lib/database.types'
import styles from './NewTaskModal.module.css'

export interface NewTaskPayload {
  title: string
  status: Exclude<TaskStatus, 'context'>
  priority: TaskPriority
  dueDate: string
  labels: { name: string }[]
}

interface Props {
  onClose: () => void
  onSubmit: (task: NewTaskPayload) => void
}

const STATUSES: { value: Exclude<TaskStatus, 'context'>; label: string }[] = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'ready',       label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review',   label: 'In Review' },
  { value: 'completed',   label: 'Completed' },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
]

export default function NewTaskModal({ onClose, onSubmit }: Props) {
  const [title, setTitle]       = useState('')
  const [status, setStatus]     = useState<Exclude<TaskStatus, 'context'>>('backlog')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]   = useState('')
  const [labelText, setLabelText] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const labels = labelText
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => ({ name }))
    onSubmit({ title: title.trim(), status, priority, dueDate, labels })
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New Task</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Title</span>
            <input
              className={styles.input}
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <div className={styles.row}>
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Status</span>
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value as Exclude<TaskStatus, 'context'>)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Priority</span>
              <select
                className={styles.select}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Due Date <span className={styles.optional}>(optional)</span>
              </span>
              <input
                className={`${styles.input} ${styles.dateInput}`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Labels <span className={styles.optional}>(comma-separated)</span>
              </span>
              <input
                className={styles.input}
                type="text"
                placeholder="backend, frontend…"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={!title.trim()}>
              + Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
