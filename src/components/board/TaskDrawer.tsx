import { useEffect, useRef, useState } from 'react'
import type { BoardTask } from '../../pages/BoardPage'
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
  onClose: () => void
  onUpdate: (changes: Partial<BoardTask>) => void
}

export default function TaskDrawer({ task, boardId, onClose, onUpdate }: Props) {
  const [title, setTitle]           = useState(task.title)
  const [status, setStatus]         = useState(task.status)
  const [priority, setPriority]     = useState(task.priority)
  const [dueDate, setDueDate]       = useState(task.dueDate ?? '')
  const [available, setAvailable]   = useState<AvailableLabel[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Sync field state if a different task is opened
  useEffect(() => {
    setTitle(task.title)
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.dueDate ?? '')
  }, [task.id])

  // Load available board labels + current task label IDs
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

  // Auto-resize title textarea
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

    const newIds = isSelected
      ? selectedIds.filter((id) => id !== labelId)
      : [...selectedIds, labelId]

    setSelectedIds(newIds)
    onUpdate({
      labels: available
        .filter((l) => newIds.includes(l.id))
        .map((l) => ({ name: l.name, color: l.color })),
    })
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
          <textarea
            ref={titleRef}
            className={styles.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur() } }}
            rows={1}
          />

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
        </div>
      </aside>
    </>
  )
}
