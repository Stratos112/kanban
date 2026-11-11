import { useEffect, useRef, useState } from 'react'
import type { TaskPriority, TaskStatus } from '../../lib/database.types'
import { PRESET_LABELS } from '../../lib/labels'
import styles from './NewTaskModal.module.css'

export interface NewTaskPayload {
  title: string
  status: Exclude<TaskStatus, 'context'>
  priority: TaskPriority
  dueDate: string
  labels: { name: string }[]
  context: {
    text: string
    relationType: string
    linkType: string
    priority: TaskPriority
    labels: string[]
  }
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

/* ── Modal ───────────────────────────────────────────── */
export default function NewTaskModal({ onClose, onSubmit }: Props) {
  const [title, setTitle]                 = useState('')
  const [status, setStatus]               = useState<Exclude<TaskStatus, 'context'>>('backlog')
  const [priority, setPriority]           = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]             = useState('')
  const [labels, setLabels]               = useState<string[]>([])
  const [contextOpen, setContextOpen]         = useState(false)
  const [contextText, setContextText]         = useState('')
  const [contextRelType, setContextRelType]   = useState('details')
  const [contextLinkType, setContextLinkType] = useState('blocking')
  const [contextPriority, setContextPriority] = useState<TaskPriority>('normal')
  const [contextLabels, setContextLabels]     = useState<string[]>([])
  const contextTextareaRef    = useRef<HTMLTextAreaElement>(null)
  const contextLabelsTouched  = useRef(false)

  useEffect(() => {
    if (!contextLabelsTouched.current) setContextLabels(labels)
  }, [labels])

  function handleContextLabelsChange(next: string[]) {
    contextLabelsTouched.current = true
    setContextLabels(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextOpen) setContextOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, contextOpen])

  function togglePanel() {
    if (contextOpen) {
      setContextOpen(false)
    } else {
      setContextOpen(true)
      setTimeout(() => contextTextareaRef.current?.focus(), 50)
    }
  }

  function handleContextTypeChange(type: string) {
    setContextRelType(type)
    if (type === 'question') setContextLinkType('blocking')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      status,
      priority,
      dueDate,
      labels: labels.map((name) => ({ name })),
      context: {
        text:         contextText,
        relationType: contextRelType,
        linkType:     contextLinkType,
        priority:     contextPriority,
        labels:       contextLabels,
      },
    })
  }

  const relTypeLabel = CONTEXT_TYPES.find((r) => r.value === contextRelType)?.label ?? 'Details'

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

              {/* Context seed — always present, click to toggle panel */}
              <div
                className={`${styles.contextSeed} ${contextOpen ? styles.contextSeedActive : ''}`}
                onClick={togglePanel}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel() }
                }}
              >
                <span className={styles.contextSeedBadge}>{relTypeLabel}</span>
                <span className={`${styles.contextSeedText} ${contextText ? styles.contextSeedTextFilled : ''}`}>
                  {contextText || 'Add context…'}
                </span>
                <svg
                  className={styles.contextSeedArrow}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
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

        {/* ── Context panel (slides in to the right) ── */}
        <div
          className={`${styles.contextPanelWrap} ${contextOpen ? styles.contextPanelWrapOpen : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.contextPanel}>
            <div className={styles.contextPanelHeader}>
              <span className={styles.contextPanelTitle}>Context</span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setContextOpen(false)}
                aria-label="Close context panel"
              >✕</button>
            </div>
            <div className={styles.contextPanelBody}>
              <div className={styles.contextPanelMeta}>
                <select
                  className={styles.contextRelSelect}
                  value={contextRelType}
                  onChange={(e) => handleContextTypeChange(e.target.value)}
                >
                  {CONTEXT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {contextRelType === 'question' && (
                  <select
                    className={styles.contextLinkSelect}
                    value={contextLinkType}
                    onChange={(e) => setContextLinkType(e.target.value)}
                  >
                    {LINK_TYPES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                )}
                <select
                  className={styles.contextLinkSelect}
                  value={contextPriority}
                  onChange={(e) => setContextPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <div className={styles.contextPanelLabelWrap}>
                  <LabelPicker selected={contextLabels} onChange={handleContextLabelsChange} />
                </div>
              </div>
              <textarea
                ref={contextTextareaRef}
                className={styles.contextTextarea}
                placeholder={CONTEXT_PLACEHOLDERS[contextRelType] ?? 'Add context…'}
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
