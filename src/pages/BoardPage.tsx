import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import TaskCard from '../components/board/TaskCard'
import NewTaskModal, { type NewTaskPayload } from '../components/board/NewTaskModal'
import { useAuth } from '../lib/AuthContext'
import { getBoardBySlug } from '../lib/boards'
import { supabase } from '../lib/supabase'
import styles from './BoardPage.module.css'
import type { TaskPriority, TaskStatus } from '../lib/database.types'

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: 'backlog',     label: 'Backlog',     accent: 'var(--color-col-backlog)' },
  { key: 'ready',       label: 'Ready',       accent: 'var(--color-col-ready)' },
  { key: 'in_progress', label: 'In Progress', accent: 'var(--color-col-in-progress)' },
  { key: 'in_review',   label: 'In Review',   accent: 'var(--color-col-in-review)' },
  { key: 'completed',   label: 'Completed',   accent: 'var(--color-col-completed)' },
]

interface BoardTask {
  id: string
  refKey: number
  type: 'task'
  status: Exclude<TaskStatus, 'context'>
  title: string
  priority: TaskPriority
  dueDate?: string
  labels: { name: string }[]
}

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>()
  const { userId, loading: authLoading } = useAuth()

  const [boardId, setBoardId]       = useState<string | null>(null)
  const [boardName, setBoardName]   = useState('')
  const [tasks, setTasks]           = useState<BoardTask[]>([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)

  // Load board then tasks
  useEffect(() => {
    if (!slug || authLoading) return
    getBoardBySlug(slug).then((board) => {
      if (!board) return
      setBoardId(board.id)
      setBoardName(board.name)
      loadTasks(board.id)
    })
  }, [slug, authLoading])

  // Real-time subscription
  useEffect(() => {
    if (!boardId) return
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` },
        () => loadTasks(boardId),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [boardId])

  async function loadTasks(id: string) {
    setLoadingTasks(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_labels(labels(name, color))')
      .eq('board_id', id)
      .neq('status', 'context')
      .order('position', { ascending: true })

    if (error) { console.error(error); setLoadingTasks(false); return }

    setTasks((data ?? []).map((row) => ({
      id:       row.id,
      refKey:   row.ref_key,
      type:     'task',
      status:   row.status as Exclude<TaskStatus, 'context'>,
      title:    row.title ?? '',
      priority: (row.priority ?? 'normal') as TaskPriority,
      dueDate:  row.due_date ?? undefined,
      labels:   (row.task_labels as any[])
                  .map((tl) => tl.labels)
                  .filter(Boolean)
                  .map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })),
    })))
    setLoadingTasks(false)
  }

  async function handleCreate(payload: NewTaskPayload) {
    if (!userId || !boardId) return

    const { data: row, error } = await supabase
      .from('tasks')
      .insert({
        user_id:  userId,
        board_id: boardId,
        type:     'task',
        title:    payload.title,
        status:   payload.status,
        priority: payload.priority,
        due_date: payload.dueDate || null,
        position: tasks.length,
      })
      .select()
      .single()

    if (error || !row) { console.error(error); return }

    for (const { name } of payload.labels) {
      let { data: label } = await supabase
        .from('labels')
        .select('id')
        .eq('board_id', boardId)
        .eq('name', name)
        .maybeSingle()

      if (!label) {
        const { data: created } = await supabase
          .from('labels')
          .insert({ user_id: userId, board_id: boardId, name, color: '#64748b' })
          .select('id')
          .single()
        label = created
      }

      if (label) {
        await supabase.from('task_labels').insert({ task_id: row.id, label_id: label.id })
      }
    }

    // Real-time will update the list; optimistically add now too
    setTasks((prev) => [...prev, {
      id:       row.id,
      refKey:   row.ref_key,
      type:     'task',
      status:   row.status as Exclude<TaskStatus, 'context'>,
      title:    row.title ?? '',
      priority: (row.priority ?? 'normal') as TaskPriority,
      dueDate:  row.due_date ?? undefined,
      labels:   payload.labels,
    }])
    setModalOpen(false)
  }

  const tasksInColumn = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status)

  const isLoading = authLoading || loadingTasks

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{boardName || 'Board'}</h1>
          <span className={styles.taskCount}>{tasks.length} tasks</span>
        </div>
        <div className={styles.headerRight}>
          <input className={styles.search} type="search" placeholder="Search tasks…" />
          <button
            className={styles.addButton}
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={isLoading}
          >
            + New Task
          </button>
        </div>
      </header>

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const colTasks = tasksInColumn(col.key)
          const css = { '--col-accent': col.accent } as React.CSSProperties
          return (
            <section
              key={col.key}
              className={[
                styles.column,
                col.key === 'in_review' && styles.inReviewColumn,
                col.key === 'completed' && styles.completedColumn,
              ].filter(Boolean).join(' ')}
              style={css}
            >
              <div className={styles.columnHeader} style={css}>
                <span className={styles.columnLabel}>{col.label}</span>
                <span className={styles.columnCount}>{colTasks.length}</span>
              </div>
              <div className={styles.columnBody}>
                {isLoading
                  ? <div className={styles.empty}>Loading…</div>
                  : colTasks.length === 0
                    ? <div className={styles.empty}>No tasks</div>
                    : colTasks.map((t) => <TaskCard key={t.id} {...t} />)
                }
              </div>
            </section>
          )
        })}

        <section
          className={`${styles.column} ${styles.contextColumn}`}
          style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
        >
          <div
            className={styles.columnHeader}
            style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
          >
            <span className={styles.columnLabel}>Context</span>
            <span className={styles.columnCount}>0</span>
          </div>
          <div className={styles.columnBody}>
            <div className={styles.empty}>No context cards</div>
          </div>
        </section>
      </div>

      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
