import { useEffect, useRef, useState } from 'react'
import type { TaskPriority, TaskStatus } from '../../lib/database.types'
import { PRESET_LABELS } from '../../lib/labels'
import styles from './NewTaskModal.module.css'

interface UserOption { id: string; displayName: string; avatarColor: string }

export interface ContextPanelData {
  text: string
  relationType: string
  linkType: string
  priority: TaskPriority
  labels: string[]
}

export interface NewTaskPayload {
  title: string
  status: Exclude<TaskStatus, 'context'>
  priority: TaskPriority
  dueDate: string
  assigneeId: string
  labels: { name: string }[]
  contexts: ContextPanelData[]
}

const CONTEXT_TYPES = [
  { value: 'details',    label: 'Details' },
  { value: 'question',   label: 'Question' },
  { value: 'assumption', label: 'Assumption' },
]

const LINK_TYPES = [
  { value: 'blocking',   label: 'Blocking' },
  { value: 'waiting_on', label: 'Waiting On' },
  { value: 'more_info',  label: 'More Info' },
]

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  details:    'Add notes, comments, or descriptions…',
  question:   'State what you want to find out…',
  assumption: 'Describe what you\'re assuming to be true…',
}

interface Props {
  onClose: () => void
  onSubmit: (task: NewTaskPayload) => void
  users: UserOption[]
  currentUserId: string
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

/* ── Single context panel ────────────────────────────── */
interface PanelState {
  id: number
  text: string
  relationType: string
  linkType: string
  priority: TaskPriority
  labels: string[]
  labelsManuallySet: boolean
}

interface ContextPanelProps {
  panel: PanelState
  canClose: boolean
  taskLabels: string[]
  onChange: (id: number, changes: Partial<PanelState>) => void
  onClose: (id: number) => void
}

function ContextPanel({ panel, canClose, taskLabels, onChange, onClose }: ContextPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync task labels when not manually set
  useEffect(() => {
    if (!panel.labelsManuallySet) {
      onChange(panel.id, { labels: taskLabels })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskLabels])

  function handleContextTypeChange(type: string) {
    onChange(panel.id, { relationType: type })
    if (type === 'question') onChange(panel.id, { linkType: 'blocking' })
  }

  function handleLabelsChange(next: string[]) {
    onChange(panel.id, { labels: next, labelsManuallySet: true })
  }

  return (
    <div className={styles.contextPanel} onClick={(e) => e.stopPropagation()}>
      <div className={styles.contextPanelHeader}>
        <span className={styles.contextPanelTitle}>Context</span>
        {canClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => onClose(panel.id)}
            aria-label="Close context panel"
          >✕</button>
        )}
      </div>
      <div className={styles.contextPanelBody}>
        <div className={styles.contextPanelMeta}>
          <select
            className={styles.contextRelSelect}
            value={panel.relationType}
            onChange={(e) => handleContextTypeChange(e.target.value)}
          >
            {CONTEXT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {panel.relationType === 'question' && (
            <select
              className={styles.contextLinkSelect}
              value={panel.linkType}
              onChange={(e) => onChange(panel.id, { linkType: e.target.value })}
            >
              {LINK_TYPES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          )}
          <select
            className={styles.contextLinkSelect}
            value={panel.priority}
            onChange={(e) => onChange(panel.id, { priority: e.target.value as TaskPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <div className={styles.contextPanelLabelWrap}>
            <LabelPicker selected={panel.labels} onChange={handleLabelsChange} />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className={styles.contextTextarea}
          placeholder={CONTEXT_PLACEHOLDERS[panel.relationType] ?? 'Add context…'}
          value={panel.text}
          onChange={(e) => onChange(panel.id, { text: e.target.value })}
          rows={5}
        />
      </div>
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────── */
let _nextPanelId = 1
function nextId() { return _nextPanelId++ }

function makePanel(labels: string[] = []): PanelState {
  return {
    id: nextId(),
    text: '',
    relationType: 'details',
    linkType: 'blocking',
    priority: 'normal',
    labels,
    labelsManuallySet: false,
  }
}

export default function NewTaskModal({ onClose, onSubmit, users, currentUserId }: Props) {
  const [title, setTitle]           = useState('')
  const [status, setStatus]         = useState<Exclude<TaskStatus, 'context'>>('backlog')
  const [priority, setPriority]     = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]       = useState('')
  const [assigneeId, setAssigneeId] = useState(currentUserId)
  const [labels, setLabels]         = useState<string[]>([])
  const [panels, setPanels]         = useState<PanelState[]>(() => [makePanel()])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePanelChange(id: number, changes: Partial<PanelState>) {
    setPanels((prev) => prev.map((p) => p.id === id ? { ...p, ...changes } : p))
  }

  function handlePanelClose(id: number) {
    setPanels((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((p) => p.id !== id)
    })
  }

  function handleAddPanel() {
    setPanels((prev) => {
      const next = [...prev, makePanel(labels)]
      // If adding a 4th, drop the oldest (index 0)
      if (next.length > 3) return next.slice(1)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      status,
      priority,
      dueDate,
      assigneeId,
      labels: labels.map((name) => ({ name })),
      contexts: panels.map((p) => ({
        text:         p.text,
        relationType: p.relationType,
        linkType:     p.linkType,
        priority:     p.priority,
        labels:       p.labels,
      })),
    })
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalRow}>

        {/* ── Main modal ── */}
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>New Task</h2>
            <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formBody}>
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

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Assignee</span>
                <select
                  className={styles.select}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === currentUserId ? `${u.displayName} (you)` : u.displayName}
                    </option>
                  ))}
                </select>
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

        {/* ── Context panels column ── */}
        <div className={styles.panelsColumn} onClick={(e) => e.stopPropagation()}>
          {panels.map((panel) => (
            <ContextPanel
              key={panel.id}
              panel={panel}
              canClose={panels.length >= 2}
              taskLabels={labels}
              onChange={handlePanelChange}
              onClose={handlePanelClose}
            />
          ))}
          <button
            type="button"
            className={styles.addPanelBtn}
            onClick={handleAddPanel}
          >
            + Provide more context
          </button>
        </div>

      </div>
    </div>
  )
}
