import { useEffect, useState } from 'react'
import type { ContextCard, BoardTask } from '../../pages/BoardPage'
import type { TaskPriority } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import styles from './ContextCardModal.module.css'

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

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
]

const PLACEHOLDERS: Record<string, string> = {
  details:    'Add notes, comments, or descriptions…',
  question:   'State what you want to find out…',
  assumption: 'Describe what you\'re assuming to be true…',
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

  useEffect(() => {
    setRelationType(card.relationType)
    setLinkType(card.linkType)
    setPriority(card.priority)
    setText(card.question)
    setAnswer(card.answer ?? '')
  }, [card.id])

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
    // Always push current answer to parent so the card redraws regardless of
    // whether saveAnswer's early-return guard fired.
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
          <select
            className={styles.relSelect}
            value={relationType}
            onChange={(e) => saveRelationType(e.target.value)}
          >
            {CONTEXT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
          <select
            className={styles.linkSelect}
            value={priority}
            onChange={(e) => savePriority(e.target.value as TaskPriority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
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
            rows={5}
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
