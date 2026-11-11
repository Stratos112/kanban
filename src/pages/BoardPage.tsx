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
import ContextCardModal from '../components/board/ContextCardModal'
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

const INVERSE_LINK: Record<string, string> = {
  blocks:     'blocked_by',
  blocked_by: 'blocks',
  parent_of:  'child_of',
  child_of:   'parent_of',
  waiting_on: 'completes',
  completes:  'waiting_on',
}

export interface BoardUser {
  id: string
  displayName: string
  avatarColor: string
}

export interface BoardTask {
  id: string
  refKey: number
  type: 'task'
  status: Exclude<TaskStatus, 'context'>
  title: string
  priority: TaskPriority
  dueDate?: string
  labels: { name: string; color?: string }[]
  assignee?: { id: string; name: string; color: string }
}

export interface ContextCard {
  id: string
  refKey: number
  title: string
  question: string
  answer?: string
  relationType: string
  linkType: string
  priority: TaskPriority
  labels: { name: string; color?: string }[]
  parentTaskId: string
}

export interface TaskLink {
  id: string
  fromTaskId: string
  toTaskId: string
  type: string
  linkedTaskId: string
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

  const [boardId, setBoardId]             = useState<string | null>(null)
  const [boardName, setBoardName]         = useState('')
  const [tasks, setTasks]                 = useState<BoardTask[]>([])
  const [contextCards, setContextCards]   = useState<ContextCard[]>([])
  const [taskLinks, setTaskLinks]         = useState<TaskLink[]>([])
  const [users, setUsers]                 = useState<BoardUser[]>([])
  const [modalOpen, setModalOpen]         = useState(false)
  const [loadingTasks, setLoadingTasks]   = useState(true)
  const [activeId, setActiveId]           = useState<string | null>(null)
  const [openTaskId, setOpenTaskId]       = useState<string | null>(null)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
  const [linkingState, setLinkingState]   = useState<{
    fromTaskId: string
    fromRefKey: number
    fromTitle: string
    linkType: string
    linkLabel: string
  } | null>(null)
  const tasksSnapshot = useRef<BoardTask[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    if (!slug || authLoading) return
    getBoardBySlug(slug).then((board) => {
      if (!board) return
      setBoardId(board.id)
      setBoardName(board.name)
      loadTasks(board.id)
    })
  }, [slug, authLoading])

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

  // Close linking mode on Escape
  useEffect(() => {
    if (!linkingState) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkingState(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkingState])

  async function loadTasks(id: string) {
    setLoadingTasks(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_labels(labels(name, color))')
      .eq('board_id', id)
      .order('position', { ascending: true })

    if (error) { console.error(error); setLoadingTasks(false); return }

    const rows = data ?? []

    // Fetch profiles for everyone active on this board (task creators + assignees + self)
    const profileIds = [...new Set([
      ...rows.map((r) => r.user_id),
      ...rows.filter((r) => r.assignee_id).map((r) => r.assignee_id as string),
      userId!,
    ])].filter(Boolean)

    const profileMap = new Map<string, { displayName: string; avatarColor: string }>()
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color')
        .in('id', profileIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { displayName: p.display_name, avatarColor: p.avatar_color })
      }
      setUsers(
        (profiles ?? [])
          .map((p) => ({ id: p.id, displayName: p.display_name, avatarColor: p.avatar_color }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
      )
    }

    setTasks(
      rows
        .filter((r) => r.status !== 'context')
        .map((row) => {
          const profile = row.assignee_id ? profileMap.get(row.assignee_id) : undefined
          return {
            id:       row.id,
            refKey:   row.ref_key,
            type:     'task' as const,
            status:   row.status as Exclude<TaskStatus, 'context'>,
            title:    row.title ?? '',
            priority: (row.priority ?? 'normal') as TaskPriority,
            dueDate:  row.due_date ?? undefined,
            labels:   (row.task_labels as any[])
                        .map((tl) => tl.labels)
                        .filter(Boolean)
                        .map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })),
            assignee: profile ? { id: row.assignee_id, name: profile.displayName, color: profile.avatarColor } : undefined,
          }
        })
    )

    setContextCards(
      rows
        .filter((r) => r.status === 'context')
        .map((row) => ({
          id:           row.id,
          refKey:       row.ref_key,
          title:        row.title ?? '',
          question:     row.question ?? '',
          answer:       row.answer ?? undefined,
          relationType: row.context_relation_type ?? 'details',
          linkType:     (row as any).parent_link_type ?? 'blocking',
          priority:     (row.priority ?? 'normal') as TaskPriority,
          labels:       (row.task_labels as any[])
                          .map((tl) => tl.labels)
                          .filter(Boolean)
                          .map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })),
          parentTaskId: row.parent_task_id ?? '',
        }))
    )

    // Load task relationships
    const { data: links } = await supabase
      .from('task_relationships')
      .select('*')
      .eq('board_id', id)

    setTaskLinks((links ?? []).map((l: any) => ({
      id:           l.id,
      fromTaskId:   l.from_task_id,
      toTaskId:     l.to_task_id,
      type:         l.type,
      linkedTaskId: l.to_task_id,
    })))

    setLoadingTasks(false)
  }

  function ctxTitle(relationType: string, parentTitle: string) {
    const type = relationType.charAt(0).toUpperCase() + relationType.slice(1)
    return `${type} for '${parentTitle}'`
  }

  async function handleCreate(payload: NewTaskPayload) {
    if (!userId || !boardId) return

    const { data: row, error } = await supabase
      .from('tasks')
      .insert({
        user_id:     userId,
        board_id:    boardId,
        type:        'task',
        title:       payload.title,
        status:      payload.status,
        priority:    payload.priority,
        due_date:    payload.dueDate || null,
        assignee_id: payload.assigneeId || null,
        position:    tasks.length,
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

    // Create a context card for each context panel
    const newCtxCards: ContextCard[] = []
    for (const ctx of payload.contexts) {
      const { data: ctxRow } = await supabase
        .from('tasks')
        .insert({
          user_id:               userId,
          board_id:              boardId,
          type:                  'context',
          status:                'context',
          title:                 ctxTitle(ctx.relationType, payload.title),
          question:              ctx.text || '',
          context_relation_type: ctx.relationType,
          parent_link_type:      ctx.linkType,
          priority:              ctx.priority,
          parent_task_id:        row.id,
          position:              contextCards.length + newCtxCards.length,
        })
        .select()
        .single()

      const ctxLabels: { name: string; color?: string }[] = []
      if (ctxRow && ctx.labels.length > 0) {
        for (const name of ctx.labels) {
          const { data: lbl } = await supabase
            .from('labels')
            .select('id, color')
            .eq('board_id', boardId)
            .eq('name', name)
            .maybeSingle()
          if (lbl) {
            await supabase.from('task_labels').insert({ task_id: ctxRow.id, label_id: lbl.id })
            ctxLabels.push({ name, color: lbl.color })
          }
        }
      }

      if (ctxRow) {
        newCtxCards.push({
          id:           ctxRow.id,
          refKey:       ctxRow.ref_key,
          title:        ctxRow.title ?? '',
          question:     ctxRow.question ?? '',
          relationType: ctx.relationType,
          linkType:     ctx.linkType,
          priority:     ctx.priority,
          labels:       ctxLabels,
          parentTaskId: row.id,
        })
      }
    }

    const assigneeUser = users.find((u) => u.id === payload.assigneeId)
    setTasks((prev) => [...prev, {
      id:       row.id,
      refKey:   row.ref_key,
      type:     'task',
      status:   row.status as Exclude<TaskStatus, 'context'>,
      title:    row.title ?? '',
      priority: (row.priority ?? 'normal') as TaskPriority,
      dueDate:  row.due_date ?? undefined,
      labels:   payload.labels,
      assignee: assigneeUser ? { id: assigneeUser.id, name: assigneeUser.displayName, color: assigneeUser.avatarColor } : undefined,
    }])
    if (newCtxCards.length > 0) {
      setContextCards((prev) => [...prev, ...newCtxCards])
    }
    setModalOpen(false)
  }

  function handleTaskUpdate(id: string, changes: Partial<BoardTask>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t))
  }

  function handleTaskDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setContextCards((prev) => prev.filter((c) => c.parentTaskId !== id))
    setOpenTaskId(null)
  }

  async function handleAddContext(parentTaskId: string, question: string, relationType: string) {
    if (!userId || !boardId) return
    const parentTask = tasks.find((t) => t.id === parentTaskId)
    const title = ctxTitle(relationType, parentTask?.title ?? 'Task')
    const { data: row } = await supabase
      .from('tasks')
      .insert({
        user_id:               userId,
        board_id:              boardId,
        type:                  'context',
        status:                'context',
        title,
        question,
        context_relation_type: relationType,
        parent_task_id:        parentTaskId,
        position:              contextCards.length,
      })
      .select()
      .single()

    if (row) {
      setContextCards((prev) => [...prev, {
        id:           row.id,
        refKey:       row.ref_key,
        title,
        question:     row.question ?? '',
        relationType,
        linkType:     'blocking',
        priority:     'normal',
        labels:       [],
        parentTaskId,
      }])
    }
  }

  function handleContextUpdate(id: string, changes: Partial<ContextCard>) {
    setContextCards((prev) => prev.map((c) => c.id === id ? { ...c, ...changes } : c))
  }

  function handleEnterLinkMode(
    fromTaskId: string,
    fromRefKey: number,
    fromTitle: string,
    linkType: string,
    linkLabel: string,
  ) {
    setOpenTaskId(null)
    setLinkingState({ fromTaskId, fromRefKey, fromTitle, linkType, linkLabel })
  }

  async function handleSelectLinkTarget(targetTask: BoardTask) {
    if (!linkingState || !boardId) return
    const { fromTaskId, linkType } = linkingState
    const inverseType = INVERSE_LINK[linkType] ?? linkType
    await Promise.all([
      supabase.from('task_relationships').insert({
        from_task_id: fromTaskId,
        to_task_id:   targetTask.id,
        type:         linkType,
        board_id:     boardId,
      }),
      supabase.from('task_relationships').insert({
        from_task_id: targetTask.id,
        to_task_id:   fromTaskId,
        type:         inverseType,
        board_id:     boardId,
      }),
    ])
    setLinkingState(null)
    loadTasks(boardId)
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

    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== activeTaskId)
      const destTasks = without.filter((t) => t.status === overCol)
      const movedTask = { ...activeTask, status: overCol }

      if (!overIsColumn) {
        const overIdx = destTasks.findIndex((t) => t.id === overId)
        const inserted = [...destTasks]
        inserted.splice(overIdx >= 0 ? overIdx : destTasks.length, 0, movedTask)
        return [...without.filter((t) => t.status !== overCol), ...inserted]
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

    if (!overIsColumn && activeTaskId !== overId) {
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask && overTask.status === activeTask.status) {
        const colTasks = tasks.filter((t) => t.status === activeTask.status)
        const oldIdx = colTasks.findIndex((t) => t.id === activeTaskId)
        const newIdx = colTasks.findIndex((t) => t.id === overId)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(colTasks, oldIdx, newIdx)
          finalTasks = [...tasks.filter((t) => t.status !== activeTask.status), ...reordered]
          setTasks(finalTasks)
        }
      }
    }

    const originalTask = tasksSnapshot.current.find((t) => t.id === activeTaskId)
    const statusChanged = originalTask?.status !== activeTask.status
    const updates: Promise<unknown>[] = []

    if (statusChanged) {
      updates.push(supabase.from('tasks').update({ status: activeTask.status }).eq('id', activeTaskId))
    }

    finalTasks.filter((t) => t.status === activeTask.status).forEach((t, i) => {
      updates.push(supabase.from('tasks').update({ position: i }).eq('id', t.id))
    })

    if (statusChanged && originalTask) {
      finalTasks.filter((t) => t.status === originalTask.status).forEach((t, i) => {
        updates.push(supabase.from('tasks').update({ position: i }).eq('id', t.id))
      })
    }

    await Promise.all(updates)
  }

  /* ── Render ────────────────────────────────────────── */
  const tasksInColumn = (status: TaskStatus) => tasks.filter((t) => t.status === status)
  const activeTask    = activeId ? tasks.find((t) => t.id === activeId) ?? null : null
  const openTask      = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null
  const isLoading     = authLoading || loadingTasks

  // Resolve task links for the open task
  const openTaskLinks = openTask
    ? taskLinks
        .filter((l) => l.fromTaskId === openTask.id)
        .map((l) => {
          const target = tasks.find((t) => t.id === l.toTaskId)
          return {
            id:           l.id,
            type:         l.type,
            toTaskRefKey: target?.refKey ?? 0,
            toTaskTitle:  target?.title ?? '',
          }
        })
    : []

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

      {/* Linking mode overlay */}
      {linkingState && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(0,0,0,0.65)',
              pointerEvents: 'auto',
            }}
            onClick={() => setLinkingState(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 20px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            Linking KAN-{linkingState.fromRefKey} as <strong>{linkingState.linkLabel}</strong> — click a task to connect
            {' '}
            <span style={{ color: 'var(--color-text-subtle)' }}>[Escape to cancel]</span>
          </div>
        </>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div
          className={styles.board}
          style={linkingState ? { position: 'relative', zIndex: 55 } as React.CSSProperties : undefined}
        >
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
                        : colTasks.map((t) => {
                            const tCtx = contextCards.filter((c) => c.parentTaskId === t.id)
                            const blockedCount = tCtx.filter((c) => c.relationType === 'question' && c.linkType === 'blocking'   && !c.answer).length
                            const waitingCount = tCtx.filter((c) => c.relationType === 'question' && c.linkType === 'waiting_on' && !c.answer).length
                            const isSelectableCard = linkingState != null && t.id !== linkingState.fromTaskId
                            return (
                              <SortableTaskCard
                                key={t.id}
                                id={t.id}
                                refKey={t.refKey}
                                type={t.type}
                                title={t.title}
                                priority={t.priority}
                                dueDate={t.dueDate}
                                labels={t.labels}
                                assigneeColor={t.assignee?.color}
                                assigneeName={t.assignee?.name}
                                blockedCount={blockedCount}
                                waitingCount={waitingCount}
                                onOpen={() => setOpenTaskId(t.id)}
                                isSelectable={isSelectableCard}
                                onSelect={() => handleSelectLinkTarget(t)}
                              />
                            )
                          })
                    }
                  </SortableContext>
                </ColumnBody>
              </section>
            )
          })}

          {/* Context column */}
          <section
            className={`${styles.column} ${styles.contextColumn}`}
            style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
          >
            <div
              className={styles.columnHeader}
              style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
            >
              <span className={styles.columnLabel}>Context</span>
              <span className={styles.columnCount}>{contextCards.length}</span>
            </div>
            <div className={styles.columnBody}>
              {isLoading
                ? <div className={styles.empty}>Loading…</div>
                : contextCards.length === 0
                  ? <div className={styles.empty}>No context cards</div>
                  : contextCards.map((c) => {
                      const parent = tasks.find((t) => t.id === c.parentTaskId)
                      return (
                        <div key={c.id} onClick={() => setOpenContextId(c.id)} style={{ cursor: 'pointer' }}>
                          <TaskCard
                            refKey={c.refKey}
                            type="context"
                            title={c.title}
                            relationType={c.relationType}
                            question={c.question}
                            answer={c.answer}
                            priority={c.priority}
                            parentRefKey={parent?.refKey}
                            parentTitle={parent?.title}
                          />
                        </div>
                      )
                    })
              }
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
                assigneeColor={activeTask.assignee?.color}
                assigneeName={activeTask.assignee?.name}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
          users={users}
          currentUserId={userId ?? ''}
        />
      )}

      {openContextId && (() => {
        const ctxCard = contextCards.find((c) => c.id === openContextId)
        const ctxParent = ctxCard ? tasks.find((t) => t.id === ctxCard.parentTaskId) : undefined
        return ctxCard ? (
          <ContextCardModal
            card={ctxCard}
            parentTask={ctxParent}
            onClose={() => setOpenContextId(null)}
            onUpdate={handleContextUpdate}
          />
        ) : null
      })()}

      {openTask && boardId && (
        <TaskDrawer
          task={openTask}
          boardId={boardId}
          users={users}
          currentUserId={userId ?? ''}
          contextCards={contextCards.filter((c) => c.parentTaskId === openTask.id)}
          taskLinks={openTaskLinks}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(changes) => handleTaskUpdate(openTask.id, changes)}
          onDelete={handleTaskDelete}
          onAddContext={(q, rt) => handleAddContext(openTask.id, q, rt)}
          onOpenContext={setOpenContextId}
          onEnterLinkMode={handleEnterLinkMode}
        />
      )}
    </div>
  )
}
