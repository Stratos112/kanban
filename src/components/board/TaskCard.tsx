import type { TaskPriority } from '../../lib/database.types'
import styles from './TaskCard.module.css'

export interface TaskCardProps {
  refKey: number
  type: 'task' | 'context'
  title?: string | null
  question?: string | null
  answer?: string | null
  priority?: TaskPriority | null
  dueDate?: string | null
  labels?: { name: string; color?: string }[]
  assigneeColor?: string | null
  assigneeName?: string | null
}

export default function TaskCard({
  refKey,
  type,
  title,
  question,
  answer,
  priority,
  dueDate,
  labels = [],
  assigneeColor,
  assigneeName,
}: TaskCardProps) {
  const isContext = type === 'context'

  return (
    <div
      className={`${styles.card} ${isContext ? styles.contextCard : ''} ${priority ? styles[`priority_${priority}`] : ''}`}
    >
      <div className={styles.header}>
        <span className={styles.refKey}>
          {isContext ? '?' : ''}KAN-{refKey}
        </span>
        {!isContext && priority && (
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
            <p className={styles.question}>{question}</p>
            {answer
              ? <p className={styles.answer}>{answer}</p>
              : <span className={styles.unanswered}>Unanswered</span>
            }
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
