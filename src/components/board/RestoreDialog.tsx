import { useState } from 'react'
import type { CascadedTask } from '../../lib/completion'
import styles from './RestoreDialog.module.css'

interface Props {
  taskTitle: string
  cascadedTasks: CascadedTask[]
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ')
}

export default function RestoreDialog({ taskTitle, cascadedTasks, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(cascadedTasks.map((t) => t.id))
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const count = selected.size

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>Restore related tasks?</h2>
        </div>

        <div className={styles.body}>
          <p className={styles.desc}>
            These tasks were automatically completed when{' '}
            <strong>"{taskTitle}"</strong> was completed. Select which to restore:
          </p>

          <ul className={styles.list}>
            {cascadedTasks.map((task) => (
              <li key={task.id}>
                <label className={styles.item}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(task.id)}
                    onChange={() => toggle(task.id)}
                  />
                  <span className={styles.refKey}>KAN-{task.refKey}</span>
                  <span className={styles.taskTitle}>{task.title || '(untitled)'}</span>
                  <span className={styles.prevStatus}>→ {formatStatus(task.previousStatus)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.footer}>
          <button className={styles.skipBtn} type="button" onClick={onCancel}>
            Skip restore
          </button>
          <button
            className={styles.restoreBtn}
            type="button"
            onClick={() => onConfirm([...selected])}
          >
            Restore {count} task{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
