import { useEffect, useState } from 'react'
import type { ContextCard, BoardTask } from '../../pages/BoardPage'
import type { TaskPriority } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import styles from './ContextCardModal.module.css'

const CONTEXT_TYPES = [
  { value: 'question', label: 'Question' },
  { value: 'comment',  label: 'Comment' },
]

const LINK_TYPES = [
  { value: 'blocking',   label: 'Blocking' },
  { value: 'waiting_on', label: 'Waiting On' },
  { value: 'more_info',  label: 'More Info' },
]

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
]

const PLACEHOLDERS: Record<string, string> = {
  details:  'Describe this task…',
  question: 'State what you want to find out…',
  comment:  'Add a note or comment…',
}

interface ActivityEntry {
  id: string
  action: string
  payload: Record<string, unknown> | null
  created_at: string
}

function formatActivity(entry: ActivityEntry): string {
  const p = entry.payload ?? {}
  switch (entry.action) {
    case 'task_created':     return 'Task created'
    case 'title_edited':     return 'Title updated'
    case 'status_changed':   return `Status: ${p.from} → ${p.to}`
    case 'priority_changed': return `Priority: ${p.from} → ${p.to}`
    case 'assigned':         return `Assigned to ${p.name}`
    case 'unassigned':       return 'Unassigned'
    case 'due_date_set':     return `Due date: ${p.to}`
    case 'due_date_cleared': return 'Due date removed'
    case 'comment_added':    return 'Comment added'
    case 'question_added':   return 'Question added'
    default:                 return entry.action.replace(/_/g, ' ')
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

interface Props {
  card: ContextCard
  parentTask?: BoardTask
  onClose: () => void
  onUpdate: (id: string, changes: Partial<ContextCard>) => void
}

export default function ContextCardModal({ card, parentTask, onClose, onUpdate }: Props) {
  const [relationType, setRelationType] = useState(card.relationType)
  const [linkType, setLinkType]         = useState(card.linkType)
  const [priority, setPriority]         = useState<TaskPriority>(card.priority)
  const [text, setText]                 = useState(card.question)
  const [answer, setAnswer]             = useState(card.answer ?? '')
  const [activityLog, setActivityLog]   = useState<ActivityEntry[]>([])

  const isDetails = relationType === 'details'

  useEffect(() => {
    setRelationType(card.relationType)
    setLinkType(card.linkType)
    setPriority(card.priority)
    setText(card.question)
    setAnswer(card.answer ?? '')
  }, [card.id])

  useEffect(() => {
    if (!isDetails || !card.parentTaskId) return
    supabase
      .from('activity_log')
      .select('id, action, payload, created_at')
      .eq('task_id', card.parentTaskId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setActivityLog((data as ActivityEntry[]) ?? []))
  }, [card.id, isDetails])

  /* Capture-phase listener fires before the TaskDrawer's bubble-phase listener,
     so Escape only closes this modal and not the drawer behind it. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  async function saveRelationType(val: string) {
    setRelationType(val)
    await supabase.from('tasks').update({ context_relation_type: val }).eq('id', card.id)
    onUpdate(card.id, { relationType: val })
  }

  async function saveLinkType(val: string) {
    setLinkType(val)
    await supabase.from('tasks').update({ parent_link_type: val } as any).eq('id', card.id)
    onUpdate(card.id, { linkType: val })
  }

  async function savePriority(val: TaskPriority) {
    setPriority(val)
    await supabase.from('tasks').update({ priority: val }).eq('id', card.id)
    onUpdate(card.id, { priority: val })
  }

  async function saveText() {
    const trimmed = text.trim()
    if (trimmed === card.question) return
    await supabase.from('tasks').update({ question: trimmed }).eq('id', card.id)
    onUpdate(card.id, { question: trimmed })
  }

  async function saveAnswer() {
    if (answer === (card.answer ?? '')) return
    await supabase.from('tasks').update({ answer: answer || null }).eq('id', card.id)
    onUpdate(card.id, { answer: answer || undefined })
  }

  async function handleDone() {
    await Promise.all([saveText(), saveAnswer()])
    onUpdate(card.id, { answer: answer.trim() || undefined })
    onClose()
  }

  const isQuestion = relationType === 'question'

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.refKey}>KAN-{card.refKey}</span>
            {parentTask && (
              <span className={styles.parentLink}>
                <span className={styles.arrow}>→</span>
                <span className={styles.parentRefKey}>KAN-{parentTask.refKey}</span>
                <span className={styles.parentTitle}>{parentTask.title}</span>
              </span>
            )}
          </div>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.meta}>
          {isDetails ? (
            <span className={styles.detailsTypeBadge}>Details</span>
          ) : (
            <select
              className={styles.relSelect}
              value={relationType}
              onChange={(e) => saveRelationType(e.target.value)}
            >
              {CONTEXT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}
          {isQuestion && (
            <select
              className={styles.linkSelect}
              value={linkType}
              onChange={(e) => saveLinkType(e.target.value)}
            >
              {LINK_TYPES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          )}
          {!isDetails && (
            <select
              className={styles.linkSelect}
              value={priority}
              onChange={(e) => savePriority(e.target.value as TaskPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          )}
          {card.labels.length > 0 && (
            <div className={styles.labelChips}>
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

        <div className={styles.body}>
          <textarea
            className={styles.textArea}
            placeholder={PLACEHOLDERS[relationType] ?? 'Add context…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={saveText}
            rows={isDetails ? 4 : 5}
            autoFocus
          />
          {isQuestion && (
            <div className={styles.answerSection}>
              <span className={styles.answerLabel}>Answer</span>
              <textarea
                className={styles.answerArea}
                placeholder="Add an answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onBlur={saveAnswer}
                rows={3}
              />
            </div>
          )}
          {isDetails && (
            <>
              <span className={styles.activityLogLabel}>Activity</span>
              <div className={styles.activityLog}>
                {activityLog.length === 0 ? (
                  <p className={styles.activityEmpty}>No activity yet.</p>
                ) : (
                  activityLog.map((entry) => (
                    <div key={entry.id} className={styles.activityEntry}>
                      <span className={styles.activityText}>{formatActivity(entry)}</span>
                      <span className={styles.activityTime}>{timeAgo(entry.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.doneBtn} onClick={handleDone}>
            Done
          </button>
        </div>

      </div>
    </div>
  )
}
