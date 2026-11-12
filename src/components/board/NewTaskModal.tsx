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
  description: string
  contexts: ContextPanelData[]
}

const CONTEXT_TYPES = [
  { value: 'question', label: 'Question' },
  { value: 'comment',  label: 'Comment' },
]

const LINK_TYPES = [
  { value: 'blocking',   label: 'Blocking' },
  { value: 'waiting_on', label: 'Waiting On' },
  { value: 'more_info',  label: 'More Info' },
]

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  question: 'State what you want to find out…',
  comment:  'Add a note or comment…',
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

/* ── Context panel state ─────────────────────────────── */
interface PanelState {
  id: number
  text: string
  relationType: string
  linkType: string
  priority: TaskPriority
}

let _nextPanelId = 1
function nextId() { return _nextPanelId++ }

function makePanel(): PanelState {
  return { id: nextId(), text: '', relationType: 'question', linkType: 'blocking', priority: 'normal' }
}

/* ── Details side panel ──────────────────────────────── */
interface DetailsSidePanelProps {
  value: string
  onChange: (val: string) => void
  onClose: () => void
}

function DetailsSidePanel({ value, onChange, onClose }: DetailsSidePanelProps) {
  return (
    <div className={styles.contextPanel}>
      <div className={styles.contextPanelHeader}>
        <span className={styles.contextPanelTitle}>Details</span>
        <button type="button" className={styles.contextPanelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>
      <div className={styles.contextPanelBody}>
        <textarea
          className={styles.contextTextarea}
          placeholder="Describe this task… (optional)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      </div>
    </div>
  )
}

/* ── Side context panel ──────────────────────────────── */
interface ContextSidePanelProps {
  panel: PanelState
  onChange: (changes: Partial<PanelState>) => void
  onClose: () => void
}

function ContextSidePanel({ panel, onChange, onClose }: ContextSidePanelProps) {
  return (
    <div className={styles.contextPanel}>
      <div className={styles.contextPanelHeader}>
        <div className={styles.contextPanelControls}>
          <select
            className={styles.contextRelSelect}
            value={panel.relationType}
            onChange={(e) => {
              const type = e.target.value
              onChange({ relationType: type, ...(type === 'question' ? { linkType: 'blocking' } : {}) })
            }}
          >
            {CONTEXT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {panel.relationType === 'question' && (
            <select
              className={styles.contextLinkSelect}
              value={panel.linkType}
              onChange={(e) => onChange({ linkType: e.target.value })}
            >
              {LINK_TYPES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          )}
        </div>
        <button type="button" className={styles.contextPanelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>
      <div className={styles.contextPanelBody}>
        <textarea
          className={styles.contextTextarea}
          placeholder={CONTEXT_PLACEHOLDERS[panel.relationType] ?? 'Add context…'}
          value={panel.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────── */
export default function NewTaskModal({ onClose, onSubmit, users, currentUserId }: Props) {
  const [title, setTitle]           = useState('')
  const [status, setStatus]         = useState<Exclude<TaskStatus, 'context'>>('backlog')
  const [priority, setPriority]     = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]       = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [labels, setLabels]         = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [panels, setPanels]         = useState<PanelState[]>([])
  const [openPanelIds, setOpenPanelIds] = useState<number[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePanelChange(id: number, changes: Partial<PanelState>) {
    setPanels((prev) => prev.map((p) => p.id === id ? { ...p, ...changes } : p))
  }

  function openPanel(id: number) {
    setOpenPanelIds((prev) => {
      if (prev.includes(id)) return prev
      if (prev.length < 2) return [...prev, id]
      return [prev[1], id] // drop oldest, open new
    })
  }

  function closePanel(id: number) {
    setOpenPanelIds((prev) => prev.filter((p) => p !== id))
  }

  function handleAddPanel() {
    const p = makePanel()
    setPanels((prev) => [...prev, p])
    setOpenPanelIds((prev) => {
      if (prev.length < 2) return [...prev, p.id]
      return [prev[1], p.id]
    })
  }

  function handlePanelRemove(id: number) {
    setPanels((prev) => prev.filter((p) => p.id !== id))
    closePanel(id)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title:       title.trim(),
      status,
      priority,
      dueDate,
      assigneeId,
      description: description.trim(),
      labels:      labels.map((name) => ({ name })),
      contexts:    panels.map((p) => ({
        text:         p.text,
        relationType: p.relationType,
        linkType:     p.linkType,
        priority:     p.priority,
        labels,
      })),
    })
  }

  const openPanels = openPanelIds
    .map((id) => panels.find((p) => p.id === id))
    .filter(Boolean) as PanelState[]

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalRow} onClick={(e) => e.stopPropagation()}>

        {/* ── Main modal ── */}
        <div className={styles.modal}>
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
                    min={new Date().toLocaleDateString('en-CA')}
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
                  {users.filter((u) => u.id === currentUserId).map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName} (you)</option>
                  ))}
                </select>
              </label>

              {/* ── Context list ── */}
              <div className={styles.contextSection}>
                <span className={styles.contextSectionLabel}>Context</span>

                {/* Required Details row — always present, no remove button */}
                <div
                  className={`${styles.contextRow} ${detailsOpen ? styles.contextRowActive : ''}`}
                  onClick={() => setDetailsOpen((v) => !v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetailsOpen((v) => !v) }}
                >
                  <span className={styles.contextRowType}>Details</span>
                  <span className={styles.contextRowText}>
                    {description
                      ? description
                      : <em className={styles.contextRowEmpty}>Description &amp; activity log…</em>
                    }
                  </span>
                </div>

                {panels.map((panel) => {
                  const isOpen = openPanelIds.includes(panel.id)
                  const typeLabel = CONTEXT_TYPES.find((t) => t.value === panel.relationType)?.label ?? panel.relationType
                  return (
                    <div
                      key={panel.id}
                      className={`${styles.contextRow} ${isOpen ? styles.contextRowActive : ''}`}
                      onClick={() => openPanel(panel.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPanel(panel.id) }}
                    >
                      <span className={styles.contextRowType}>{typeLabel}</span>
                      {panel.relationType === 'question' && (
                        <span className={styles.contextRowLink}>
                          {LINK_TYPES.find((l) => l.value === panel.linkType)?.label ?? panel.linkType}
                        </span>
                      )}
                      <span className={styles.contextRowText}>
                        {panel.text
                          ? panel.text
                          : <em className={styles.contextRowEmpty}>No content yet…</em>
                        }
                      </span>
                      <button
                        type="button"
                        className={styles.contextRowRemove}
                        onClick={(e) => { e.stopPropagation(); handlePanelRemove(panel.id) }}
                        aria-label="Remove context"
                      >✕</button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  className={styles.addContextBtn}
                  onClick={handleAddPanel}
                >
                  + Add context
                </button>
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

        {/* ── Side panels ── */}
        {(detailsOpen || openPanels.length > 0) && (
          <div className={styles.panelsColumn}>
            {detailsOpen && (
              <DetailsSidePanel
                value={description}
                onChange={setDescription}
                onClose={() => setDetailsOpen(false)}
              />
            )}
            {openPanels.map((panel) => (
              <ContextSidePanel
                key={panel.id}
                panel={panel}
                onChange={(changes) => handlePanelChange(panel.id, changes)}
                onClose={() => closePanel(panel.id)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
