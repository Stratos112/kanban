import { useState } from 'react'
import type { CascadedTask } from '../../lib/completion'
import styles from './RestoreDialog.module.css'

export interface BlockedRestorable {
  id: string
  refKey: number
  title: string
}

interface Props {
  taskTitle: string
  cascadedTasks: CascadedTask[]
  blockedTasks?: BlockedRestorable[]
  onConfirm: (selectedCascadeIds: string[], selectedBlockedIds: string[]) => void
  onCancel: () => void
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ')
}

export default function RestoreDialog({ taskTitle, cascadedTasks, blockedTasks = [], onConfirm, onCancel }: Props) {
  const [selectedCascade, setSelectedCascade] = useState<Set<string>>(
    () => new Set(cascadedTasks.map((t) => t.id))
  )
  const [selectedBlocked, setSelectedBlocked] = useState<Set<string>>(new Set())

  function toggleCascade(id: string) {
    setSelectedCascade((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleBlocked(id: string) {
    setSelectedBlocked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalCount = selectedCascade.size + selectedBlocked.size
  const hasBoth = cascadedTasks.length > 0 && blockedTasks.length > 0

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>Restore related tasks?</h2>
        </div>

        <div className={styles.body}>
          {cascadedTasks.length > 0 && (
            <>
              {hasBoth
                ? <p className={styles.sectionLabel}>Auto-completed with "{taskTitle}"</p>
                : <p className={styles.desc}>
                    These tasks were automatically completed when{' '}
                    <strong>"{taskTitle}"</strong> was completed. Select which to restore:
                  </p>
              }
              <ul className={styles.list}>
                {cascadedTasks.map((task) => (
                  <li key={task.id}>
                    <label className={styles.item}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedCascade.has(task.id)}
                        onChange={() => toggleCascade(task.id)}
                      />
                      <span className={styles.refKey}>KAN-{task.refKey}</span>
                      <span className={styles.taskTitle}>{task.title || '(untitled)'}</span>
                      <span className={styles.prevStatus}>→ {formatStatus(task.previousStatus)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {blockedTasks.length > 0 && (
            <>
              {hasBoth
                ? <p className={styles.sectionLabel} style={{ marginTop: '14px' }}>Was blocked by "{taskTitle}"</p>
                : <p className={styles.desc}>
                    <strong>"{taskTitle}"</strong> was blocking the tasks below, which have since been completed. Restore them and re-apply the blocking relationship?
                  </p>
              }
              <ul className={styles.list}>
                {blockedTasks.map((task) => (
                  <li key={task.id}>
                    <label className={styles.item}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedBlocked.has(task.id)}
                        onChange={() => toggleBlocked(task.id)}
                      />
                      <span className={styles.refKey}>KAN-{task.refKey}</span>
                      <span className={styles.taskTitle}>{task.title || '(untitled)'}</span>
                      <span className={styles.prevStatus}>→ in progress</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.skipBtn} type="button" onClick={onCancel}>
            Skip restore
          </button>
          <button
            className={styles.restoreBtn}
            type="button"
            onClick={() => onConfirm([...selectedCascade], [...selectedBlocked])}
          >
            {totalCount > 0 ? `Restore ${totalCount} task${totalCount !== 1 ? 's' : ''}` : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  )
}
