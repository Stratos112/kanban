import type { TaskPriority } from '../../lib/database.types'
import styles from './TaskCard.module.css'

export interface TaskCardProps {
  refKey: number
  type: 'task' | 'context'
  relationType?: string
  title?: string | null
  question?: string | null
  answer?: string | null
  priority?: TaskPriority | null
  dueDate?: string | null
  labels?: { name: string; color?: string }[]
  assigneeColor?: string | null
  assigneeName?: string | null
  parentRefKey?: number
  parentTitle?: string
  blockedCount?: number
  waitingCount?: number
  isParent?: boolean
  isWaitingOnTask?: boolean
  isSelectable?: boolean
  onSelect?: () => void
}

export default function TaskCard({
  refKey,
  type,
  relationType,
  title,
  question,
  answer,
  priority,
  dueDate,
  labels = [],
  assigneeColor,
  assigneeName,
  parentRefKey,
  parentTitle,
  blockedCount = 0,
  waitingCount = 0,
  isParent = false,
  isWaitingOnTask = false,
  isSelectable,
  onSelect,
}: TaskCardProps) {
  const isContext        = type === 'context'
  const isQuestion       = isContext && relationType === 'question'
  const isAnswered       = isQuestion && !!answer
  const isBand           = isContext && (!isQuestion || isAnswered)
  const isBlocked        = blockedCount > 0
  const isWaiting        = !isBlocked && waitingCount > 0

  /* ── Narrow band for details / assumption / answered questions ── */
  if (isBand) {
    return (
      <div className={[
        styles.card,
        styles.contextCard,
        styles.contextBand,
        isAnswered ? styles.answeredQuestion : '',
      ].filter(Boolean).join(' ')}>
        <div className={styles.bandRow}>
          <span className={styles.bandType}>{relationType ?? 'details'}</span>
          <span className={styles.bandTitle}>{isAnswered ? (question || title || '—') : (parentTitle || title || '—')}</span>
          <span className={styles.refKey}>
            KAN-{refKey}
            {parentRefKey != null && <span className={styles.parentLink}> → KAN-{parentRefKey}</span>}
          </span>
        </div>
      </div>
    )
  }

  /* ── Full card for tasks and questions ── */
  const cardEl = (
    <div
      className={[
        styles.card,
        isContext ? styles.contextCard : '',
        isQuestion && !isAnswered ? styles.questionUnanswered : '',
        priority ? styles[`priority_${priority}`] : '',
        isBlocked ? styles.isBlocked : isWaiting ? styles.isWaiting : '',
        isSelectable ? styles.selectable : '',
        isWaitingOnTask ? styles.hasZzz : '',
      ].filter(Boolean).join(' ')}
      onClick={isSelectable ? onSelect : undefined}
    >
      <div className={styles.header}>
        <span className={styles.refKey}>
          KAN-{refKey}
          {isContext && parentRefKey != null && (
            <span className={styles.parentLink}> → KAN-{parentRefKey}</span>
          )}
        </span>
        {priority && (
          <span className={styles.priorityWell}>
            <span className={`${styles.priorityBadge} ${styles[`badge_${priority}`]}`}>
              {priority}
            </span>
          </span>
        )}
      </div>

      <div className={styles.body}>
        {isContext ? (
          <>
            {title && <p className={styles.contextTitle}>{title}</p>}
            {question && <p className={styles.question}>{question}</p>}
            {isQuestion && answer && <p className={styles.answer}>{answer}</p>}
            {isQuestion && !answer && <span className={styles.unanswered}>Unanswered</span>}
          </>
        ) : (
          <p className={styles.title}>{title}</p>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.labels}>
          {labels.map((l) => (
            <span
              key={l.name}
              className={styles.label}
              style={{ '--label-color': l.color } as React.CSSProperties}
            >
              {l.name}
            </span>
          ))}
          {blockedCount > 0 && (
            <span className={`${styles.statusChip} ${styles.blockerChip}`}>
              {blockedCount} blocker{blockedCount > 1 ? 's' : ''}
            </span>
          )}
          {waitingCount > 0 && (
            <span className={`${styles.statusChip} ${styles.waitingChip}`}>
              waiting on {waitingCount}
            </span>
          )}
        </div>
        <div className={styles.meta}>
          {dueDate && (
            <span className={styles.dueDate}>{formatDate(dueDate)}</span>
          )}
          {assigneeColor && (
            <span
              className={styles.avatar}
              style={{ background: assigneeColor }}
              title={assigneeName ?? 'Assignee'}
            >
              {assigneeName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!isParent) return cardEl

  return (
    <div className={styles.stackWrapper}>
      <div className={styles.stackLayer2} aria-hidden />
      <div className={styles.stackLayer1} aria-hidden />
      {cardEl}
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
