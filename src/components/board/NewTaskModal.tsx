import { useEffect, useRef, useState } from 'react'
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

const PRESET_LABELS = [
  'Backend', 'Frontend', 'Design', 'Feature',
  'Bug', 'Testing', 'DevOps', 'Scope', 'Docs',
]

/* ── Label multi-select ──────────────────────────────── */
interface LabelPickerProps {
  selected: string[]
  onChange: (labels: string[]) => void
}

function LabelPicker({ selected, onChange }: LabelPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle(label: string) {
    onChange(
      selected.includes(label)
        ? selected.filter((l) => l !== label)
        : [...selected, label],
    )
  }

  return (
    <div ref={ref} className={styles.labelPicker}>
      <button
        type="button"
        className={`${styles.input} ${styles.labelTrigger} ${open ? styles.labelTriggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span className={styles.labelPlaceholder}>Select labels…</span>
        ) : (
          <span className={styles.labelChips}>
            {selected.map((l) => (
              <span key={l} className={styles.labelChip}>{l}</span>
            ))}
          </span>
        )}
        <svg className={`${styles.chevron} ${open ? styles.chevronUp : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.labelDropdown}>
          {PRESET_LABELS.map((label) => {
            const active = selected.includes(label)
            return (
              <button
                key={label}
                type="button"
                className={`${styles.labelOption} ${active ? styles.labelOptionActive : ''}`}
                onClick={() => toggle(label)}
              >
                {active && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────── */
export default function NewTaskModal({ onClose, onSubmit }: Props) {
  const [title, setTitle]       = useState('')
  const [status, setStatus]     = useState<Exclude<TaskStatus, 'context'>>('backlog')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]   = useState('')
  const [labels, setLabels]     = useState<string[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      status,
      priority,
      dueDate,
      labels: labels.map((name) => ({ name })),
    })
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

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Labels <span className={styles.optional}>(optional)</span>
              </span>
              <LabelPicker selected={labels} onChange={setLabels} />
            </div>
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
