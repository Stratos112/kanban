import { useEffect, useRef, useState } from 'react'
import type { BoardTask, ContextCard, BoardUser, TaskLink } from '../../pages/BoardPage'
import type { TaskPriority, TaskStatus } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import TaskCard from './TaskCard'
import styles from './TaskDrawer.module.css'

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

const RELATION_TYPES = [
  { value: 'details',    label: 'Details' },
  { value: 'question',   label: 'Question' },
  { value: 'assumption', label: 'Assumption' },
]

const LINK_OPTIONS = [
  { value: 'blocks',     label: 'Blocks' },
  { value: 'blocked_by', label: 'Blocked by' },
  { value: 'parent_of',  label: 'Parent of' },
  { value: 'child_of',   label: 'Child of' },
  { value: 'waiting_on', label: 'Waiting on' },
  { value: 'completes',  label: 'Completes' },
]

function getLinkLabel(value: string) {
  return LINK_OPTIONS.find((o) => o.value === value)?.label ?? value
}

interface AvailableLabel { id: string; name: string; color: string }

/* ── Label picker ────────────────────────────────────── */
interface LabelPickerProps {
  available: AvailableLabel[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

function LabelPicker({ available, selectedIds, onToggle }: LabelPickerProps) {
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

  const selected = available.filter((l) => selectedIds.includes(l.id))

  return (
    <div ref={ref} className={styles.labelPicker}>
      <button
        type="button"
        className={`${styles.labelTrigger} ${open ? styles.labelTriggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span className={styles.labelPlaceholder}>None</span>
        ) : (
          <span className={styles.labelChips}>
            {selected.map((l) => (
              <span
                key={l.id}
                className={styles.labelChip}
                style={{ '--label-color': l.color } as React.CSSProperties}
              >
                {l.name}
              </span>
            ))}
          </span>
        )}
        <svg className={`${styles.chevron} ${open ? styles.chevronUp : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.labelDropdown}>
          {available.length === 0 && (
            <div className={styles.labelEmpty}>No labels on this board</div>
          )}
          {available.map((l) => {
            const active = selectedIds.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                className={`${styles.labelOption} ${active ? styles.labelOptionActive : ''}`}
                onClick={() => onToggle(l.id)}
              >
                <span className={styles.labelDot} style={{ background: l.color }} />
                {l.name}
                {active && (
                  <svg className={styles.check} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Drawer ──────────────────────────────────────────── */
interface ResolvedTaskLink {
  id: string
  type: string
  toTaskRefKey: number
  toTaskTitle: string
}

interface Props {
  task: BoardTask
  boardId: string
  users: BoardUser[]
  currentUserId: string
  contextCards: ContextCard[]
  taskLinks: ResolvedTaskLink[]
  onClose: () => void
  onUpdate: (changes: Partial<BoardTask>) => void
  onDelete: (id: string) => void
  onAddContext: (question: string, relationType: string) => void
  onOpenContext: (id: string) => void
  onEnterLinkMode: (fromTaskId: string, fromRefKey: number, fromTitle: string, linkType: string, linkLabel: string) => void
}

export default function TaskDrawer({
  task, boardId, users, currentUserId, contextCards, taskLinks,
  onClose, onUpdate, onDelete, onAddContext, onOpenContext, onEnterLinkMode,
}: Props) {
  const [title, setTitle]             = useState(task.title)
  const [status, setStatus]           = useState(task.status)
  const [priority, setPriority]       = useState(task.priority)
  const [dueDate, setDueDate]         = useState(task.dueDate ?? '')
  const [available, setAvailable]     = useState<AvailableLabel[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addingContext, setAddingContext]   = useState(false)
  const [newQuestion, setNewQuestion]      = useState('')
  const [newRelType, setNewRelType]        = useState('details')
  const [assigneeId, setAssigneeId]        = useState(task.assignee?.id ?? '')
  const [confirmDelete, setConfirmDelete]  = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<string>('')
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTitle(task.title)
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.dueDate ?? '')
    setAssigneeId(task.assignee?.id ?? '')
    setAddingContext(false)
    setSelectedLinkType('')
  }, [task.id])

  useEffect(() => {
    async function load() {
      const [{ data: allLabels }, { data: taskLabels }] = await Promise.all([
        supabase.from('labels').select('id, name, color').eq('board_id', boardId).order('name'),
        supabase.from('task_labels').select('label_id').eq('task_id', task.id),
      ])
      setAvailable(allLabels ?? [])
      setSelectedIds((taskLabels ?? []).map((tl: { label_id: string }) => tl.label_id))
    }
    load()
  }, [boardId, task.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  async function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === task.title) return
    await supabase.from('tasks').update({ title: trimmed }).eq('id', task.id)
    onUpdate({ title: trimmed })
  }

  async function saveStatus(val: Exclude<TaskStatus, 'context'>) {
    setStatus(val)
    await supabase.from('tasks').update({ status: val }).eq('id', task.id)
    onUpdate({ status: val })
  }

  async function savePriority(val: TaskPriority) {
    setPriority(val)
    await supabase.from('tasks').update({ priority: val }).eq('id', task.id)
    onUpdate({ priority: val })
  }

  async function saveDueDate(val: string) {
    setDueDate(val)
    await supabase.from('tasks').update({ due_date: val || null }).eq('id', task.id)
    onUpdate({ dueDate: val || undefined })
  }

  async function saveAssignee(val: string) {
    setAssigneeId(val)
    await supabase.from('tasks').update({ assignee_id: val || null }).eq('id', task.id)
    const user = users.find((u) => u.id === val)
    onUpdate({ assignee: user ? { id: user.id, name: user.displayName, color: user.avatarColor } : undefined })
  }

  async function toggleLabel(labelId: string) {
    const isSelected = selectedIds.includes(labelId)
    if (isSelected) {
      await supabase.from('task_labels').delete().eq('task_id', task.id).eq('label_id', labelId)
    } else {
      await supabase.from('task_labels').insert({ task_id: task.id, label_id: labelId })
    }
    const newIds = isSelected ? selectedIds.filter((id) => id !== labelId) : [...selectedIds, labelId]
    setSelectedIds(newIds)
    onUpdate({
      labels: available
        .filter((l) => newIds.includes(l.id))
        .map((l) => ({ name: l.name, color: l.color })),
    })
  }

  function submitContext() {
    if (!newQuestion.trim()) return
    onAddContext(newQuestion.trim(), newRelType)
    setNewQuestion('')
    setNewRelType('details')
    setAddingContext(false)
  }

  async function handleDelete() {
    await supabase.from('tasks').delete().eq('id', task.id)
    onDelete(task.id)
    onClose()
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <span className={styles.refKey}>KAN-{task.refKey}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Title */}
          <textarea
            ref={titleRef}
            className={styles.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur() } }}
            rows={1}
          />

          {/* Metadata */}
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Status</span>
              <select
                className={styles.metaSelect}
                value={status}
                onChange={(e) => saveStatus(e.target.value as Exclude<TaskStatus, 'context'>)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Priority</span>
              <select
                className={styles.metaSelect}
                value={priority}
                onChange={(e) => savePriority(e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Due Date</span>
              <input
                type="date"
                className={styles.metaDate}
                value={dueDate}
                onChange={(e) => saveDueDate(e.target.value)}
              />
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Labels</span>
              <LabelPicker
                available={available}
                selectedIds={selectedIds}
                onToggle={toggleLabel}
              />
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Assignee</span>
              <select
                className={styles.metaSelect}
                value={assigneeId}
                onChange={(e) => saveAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === currentUserId ? `${u.displayName} (you)` : u.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Context */}
          <div className={styles.contextSection}>
            <div className={styles.contextSectionHeader}>
              <span className={styles.contextSectionTitle}>Context</span>
              {!addingContext && (
                <button
                  type="button"
                  className={styles.addContextBtn}
                  onClick={() => setAddingContext(true)}
                >
                  + Add
                </button>
              )}
            </div>

            {contextCards.map((card) => (
              <div key={card.id} className={styles.contextCardLink} onClick={() => onOpenContext(card.id)}>
                <TaskCard
                  refKey={card.refKey}
                  type="context"
                  title={card.title}
                  relationType={card.relationType}
                  question={card.question}
                  priority={card.priority}
                  labels={card.labels}
                  parentRefKey={task.refKey}
                  parentTitle={task.title}
                />
              </div>
            ))}

            {addingContext && (
              <div className={styles.addContextForm}>
                <div className={styles.addContextRow}>
                  <select
                    className={styles.contextTypeSelect}
                    value={newRelType}
                    onChange={(e) => setNewRelType(e.target.value)}
                  >
                    {RELATION_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  className={styles.contextQuestionInput}
                  placeholder="What needs to be noted or clarified?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitContext() }
                    if (e.key === 'Escape') setAddingContext(false)
                  }}
                  autoFocus
                  rows={2}
                />
                <div className={styles.addContextActions}>
                  <button type="button" className={styles.cancelContextBtn} onClick={() => setAddingContext(false)}>Cancel</button>
                  <button type="button" className={styles.submitContextBtn} onClick={submitContext} disabled={!newQuestion.trim()}>Add</button>
                </div>
              </div>
            )}

            {contextCards.length === 0 && !addingContext && (
              <p className={styles.contextEmpty}>No context yet.</p>
            )}
          </div>

          {/* Linked Tasks */}
          <div className={styles.linkedSection}>
            <div className={styles.linkedSectionHeader}>
              <span className={styles.sectionTitle}>Linked Tasks</span>
            </div>
            {taskLinks.length === 0 ? (
              <p className={styles.linkedEmpty}>No linked tasks.</p>
            ) : (
              <div className={styles.linkedList}>
                {taskLinks.map((link) => (
                  <div key={link.id} className={styles.linkedItem}>
                    <span className={styles.linkedType}>{getLinkLabel(link.type)}</span>
                    <span className={styles.linkedTarget}>
                      KAN-{link.toTaskRefKey}
                      {link.toTaskTitle && <span className={styles.linkedTitle}> — {link.toTaskTitle}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connect section */}
          <div className={styles.connectSection}>
            <span className={styles.sectionTitle}>Connect to task</span>
            <div className={styles.linkTypeGrid}>
              {LINK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.linkTypeBtn} ${selectedLinkType === opt.value ? styles.linkTypeBtnActive : ''}`}
                  onClick={() => setSelectedLinkType(selectedLinkType === opt.value ? '' : opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedLinkType && (
              <button
                type="button"
                className={styles.selectTaskBtn}
                onClick={() => onEnterLinkMode(task.id, task.refKey, task.title, selectedLinkType, getLinkLabel(selectedLinkType))}
              >
                Select a task on the board →
              </button>
            )}
          </div>

          {/* Delete */}
          <div className={styles.deleteZone}>
            {confirmDelete ? (
              <div className={styles.deleteConfirm}>
                <span className={styles.deleteWarning}>Remove without completing?</span>
                <div className={styles.deleteActions}>
                  <button className={styles.deleteCancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
                  <button className={styles.deleteConfirmBtn} onClick={handleDelete}>Remove</button>
                </div>
              </div>
            ) : (
              <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
                Remove task
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
