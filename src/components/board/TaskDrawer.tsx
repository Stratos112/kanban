import { useEffect, useRef, useState } from 'react'
import type { BoardTask, ContextCard } from '../../pages/BoardPage'
import type { TaskPriority, TaskStatus } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
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

const LINK_TYPES = [
  { value: 'blocking',   label: 'Blocking' },
  { value: 'waiting_on', label: 'Waiting On' },
  { value: 'more_info',  label: 'More Info' },
]

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
interface Props {
  task: BoardTask
  boardId: string
  contextCards: ContextCard[]
  onClose: () => void
  onUpdate: (changes: Partial<BoardTask>) => void
  onDelete: (id: string) => void
  onAddContext: (question: string, relationType: string) => void
  onUpdateContext: (id: string, changes: Partial<ContextCard>) => void
}

export default function TaskDrawer({
  task, boardId, contextCards,
  onClose, onUpdate, onDelete, onAddContext, onUpdateContext,
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
  const [confirmDelete, setConfirmDelete]  = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTitle(task.title)
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.dueDate ?? '')
    setAddingContext(false)
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

  async function saveContextRelType(card: ContextCard, val: string) {
    await supabase.from('tasks').update({ context_relation_type: val }).eq('id', card.id)
    onUpdateContext(card.id, { relationType: val })
  }

  async function saveContextLinkType(card: ContextCard, val: string) {
    await supabase.from('tasks').update({ parent_link_type: val } as any).eq('id', card.id)
    onUpdateContext(card.id, { linkType: val })
  }

  async function saveContextPriority(card: ContextCard, val: TaskPriority) {
    await supabase.from('tasks').update({ priority: val }).eq('id', card.id)
    onUpdateContext(card.id, { priority: val })
  }

  async function saveContextAnswer(card: ContextCard, val: string) {
    await supabase.from('tasks').update({ answer: val || null }).eq('id', card.id)
    onUpdateContext(card.id, { answer: val || undefined })
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
              <ContextCardRow
                key={card.id}
                card={card}
                onRelTypeChange={(v) => saveContextRelType(card, v)}
                onLinkTypeChange={(v) => saveContextLinkType(card, v)}
                onPriorityChange={(v) => saveContextPriority(card, v)}
                onAnswerChange={(v) => saveContextAnswer(card, v)}
              />
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

/* ── Context card row ────────────────────────────────── */
function ContextCardRow({
  card,
  onRelTypeChange,
  onLinkTypeChange,
  onPriorityChange,
  onAnswerChange,
}: {
  card: ContextCard
  onRelTypeChange: (v: string) => void
  onLinkTypeChange: (v: string) => void
  onPriorityChange: (v: TaskPriority) => void
  onAnswerChange: (v: string) => void
}) {
  const [answer, setAnswer] = useState(card.answer ?? '')

  useEffect(() => { setAnswer(card.answer ?? '') }, [card.id])

  return (
    <div className={styles.contextCard}>
      <div className={styles.contextCardTop}>
        <select
          className={styles.contextTypeSelect}
          value={card.relationType}
          onChange={(e) => onRelTypeChange(e.target.value)}
        >
          {RELATION_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <p className={styles.contextQuestion}>{card.question || <em style={{ opacity: 0.5 }}>No description</em>}</p>
      </div>
      <div className={styles.contextCardMeta}>
        {card.relationType === 'question' && (
          <select
            className={styles.contextMetaSelect}
            value={card.linkType ?? 'blocking'}
            onChange={(e) => onLinkTypeChange(e.target.value)}
          >
            {LINK_TYPES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        )}
        <select
          className={styles.contextMetaSelect}
          value={card.priority}
          onChange={(e) => onPriorityChange(e.target.value as TaskPriority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {card.labels.length > 0 && (
          <div className={styles.contextCardLabels}>
            {card.labels.map((l) => (
              <span
                key={l.name}
                className={styles.labelChip}
                style={{ '--label-color': l.color } as React.CSSProperties}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <textarea
        className={styles.contextAnswer}
        placeholder="Add an answer…"
        value={answer}
        rows={2}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() => onAnswerChange(answer)}
      />
    </div>
  )
}
