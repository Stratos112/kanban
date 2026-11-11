import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  rectIntersection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from '../components/board/TaskCard'
import SortableTaskCard from '../components/board/SortableTaskCard'
import TaskDrawer from '../components/board/TaskDrawer'
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

export interface BoardTask {
  id: string
  refKey: number
  type: 'task'
  status: Exclude<TaskStatus, 'context'>
  title: string
  priority: TaskPriority
  dueDate?: string
  labels: { name: string; color?: string }[]
}

/* ── Droppable column body ───────────────────────────── */
function ColumnBody({
  id,
  children,
  isTarget,
}: {
  id: string
  children: React.ReactNode
  isTarget: boolean
}) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${styles.columnBody} ${isTarget ? styles.columnBodyTarget : ''}`}
    >
      {children}
    </div>
  )
}

/* ── Page ────────────────────────────────────────────── */
export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>()
  const { userId, loading: authLoading } = useAuth()

  const [boardId, setBoardId]       = useState<string | null>(null)
  const [boardName, setBoardName]   = useState('')
  const [tasks, setTasks]           = useState<BoardTask[]>([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const tasksSnapshot               = useRef<BoardTask[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

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
        () => { if (!activeId) loadTasks(boardId) },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [boardId, activeId])

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

  function handleTaskUpdate(id: string, changes: Partial<BoardTask>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t))
  }

  /* ── Drag handlers ─────────────────────────────────── */

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    tasksSnapshot.current = tasks
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeTaskId = active.id as string
    const overId = over.id as string
    if (activeTaskId === overId) return

    const activeTask = tasks.find((t) => t.id === activeTaskId)
    if (!activeTask) return

    const overIsColumn = COLUMNS.some((c) => c.key === overId)
    const overCol = overIsColumn
      ? (overId as Exclude<TaskStatus, 'context'>)
      : tasks.find((t) => t.id === overId)?.status

    if (!overCol || activeTask.status === overCol) return

    // Move task to new column, inserting before the hovered task or appending
    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== activeTaskId)
      const destTasks = without.filter((t) => t.status === overCol)

      const movedTask = { ...activeTask, status: overCol }

      if (!overIsColumn) {
        const overIdx = destTasks.findIndex((t) => t.id === overId)
        const inserted = [...destTasks]
        inserted.splice(overIdx >= 0 ? overIdx : destTasks.length, 0, movedTask)
        return [
          ...without.filter((t) => t.status !== overCol),
          ...inserted,
        ]
      }

      return [...without, movedTask]
    })
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)

    if (!over || !boardId) {
      setTasks(tasksSnapshot.current)
      return
    }

    const activeTaskId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find((t) => t.id === activeTaskId)
    if (!activeTask) return

    const overIsColumn = COLUMNS.some((c) => c.key === overId)
    let finalTasks = tasks

    // Within-column reorder
    if (!overIsColumn && activeTaskId !== overId) {
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask && overTask.status === activeTask.status) {
        const colTasks = tasks.filter((t) => t.status === activeTask.status)
        const oldIdx = colTasks.findIndex((t) => t.id === activeTaskId)
        const newIdx = colTasks.findIndex((t) => t.id === overId)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(colTasks, oldIdx, newIdx)
          finalTasks = [
            ...tasks.filter((t) => t.status !== activeTask.status),
            ...reordered,
          ]
          setTasks(finalTasks)
        }
      }
    }

    // Determine what changed vs snapshot
    const originalTask = tasksSnapshot.current.find((t) => t.id === activeTaskId)
    const statusChanged = originalTask?.status !== activeTask.status

    // Commit to DB
    const updates: Promise<unknown>[] = []

    if (statusChanged) {
      updates.push(
        supabase.from('tasks').update({ status: activeTask.status }).eq('id', activeTaskId),
      )
    }

    // Rewrite positions for the destination column
    const destColTasks = finalTasks.filter((t) => t.status === activeTask.status)
    destColTasks.forEach((t, i) => {
      updates.push(supabase.from('tasks').update({ position: i }).eq('id', t.id))
    })

    // Rewrite positions for the source column if it changed
    if (statusChanged && originalTask) {
      const srcColTasks = finalTasks.filter((t) => t.status === originalTask.status)
      srcColTasks.forEach((t, i) => {
        updates.push(supabase.from('tasks').update({ position: i }).eq('id', t.id))
      })
    }

    await Promise.all(updates)
  }

  /* ── Render ────────────────────────────────────────── */
  const tasksInColumn = (status: TaskStatus) => tasks.filter((t) => t.status === status)
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null
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

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className={styles.board}>
          {COLUMNS.map((col) => {
            const colTasks = tasksInColumn(col.key)
            const css = { '--col-accent': col.accent } as React.CSSProperties
            const isDragTarget = activeTask?.status === col.key
            return (
              <section
                key={col.key}
                className={[
                  styles.column,
                  col.key === 'in_review' && styles.inReviewColumn,
                  col.key === 'completed' && styles.completedColumn,
                  isDragTarget && styles.columnDragTarget,
                ].filter(Boolean).join(' ')}
                style={css}
              >
                <div className={styles.columnHeader} style={css}>
                  <span className={styles.columnLabel}>{col.label}</span>
                  <span className={styles.columnCount}>{colTasks.length}</span>
                </div>
                <ColumnBody id={col.key} isTarget={isDragTarget}>
                  <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {isLoading
                      ? <div className={styles.empty}>Loading…</div>
                      : colTasks.length === 0
                        ? <div className={styles.empty}>No tasks</div>
                        : colTasks.map((t) => (
                            <SortableTaskCard
                              key={t.id}
                              id={t.id}
                              refKey={t.refKey}
                              type={t.type}
                              title={t.title}
                              priority={t.priority}
                              dueDate={t.dueDate}
                              labels={t.labels}
                              onOpen={() => setOpenTaskId(t.id)}
                            />
                          ))
                    }
                  </SortableContext>
                </ColumnBody>
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

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeTask && (
            <div className={styles.dragOverlay}>
              <TaskCard
                refKey={activeTask.refKey}
                type={activeTask.type}
                title={activeTask.title}
                priority={activeTask.priority}
                dueDate={activeTask.dueDate}
                labels={activeTask.labels}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {openTask && boardId && (
        <TaskDrawer
          task={openTask}
          boardId={boardId}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(changes) => handleTaskUpdate(openTask.id, changes)}
        />
      )}
    </div>
  )
}
