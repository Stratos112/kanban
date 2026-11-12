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
import { executeCompletion, executeUncompletion, restoreBlockedTasks } from '../lib/completion'
import type { CascadeResult } from '../lib/completion'
import RestoreDialog from '../components/board/RestoreDialog'
import type { BlockedRestorable } from '../components/board/RestoreDialog'
import styles from './BoardPage.module.css'
import type { TaskPriority, TaskStatus, RelationshipType } from '../lib/database.types'

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

// Human-readable label for each link type, from both perspectives of the relationship row.
// "from" = how it looks to the task stored as from_task_id.
// "to"   = how it looks to the task stored as to_task_id (the inverse view).
const LINK_DISPLAY: Record<string, { from: string; to: string }> = {
  blocks:     { from: 'Blocks',      to: 'Blocked by' },
  blocked_by: { from: 'Blocked by',  to: 'Blocks' },
  parent_of:  { from: 'Parent of',   to: 'Child of' },
  child_of:   { from: 'Child of',    to: 'Parent of' },
  waiting_on: { from: 'Waiting on',  to: 'Completes' },
  completes:  { from: 'Completes',   to: 'Waiting on' },
  subtask:    { from: 'Child of',    to: 'Parent of' },   // legacy schema type
  details:    { from: 'Details for', to: 'Has detail' },  // legacy schema type
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
  const { userId, loading: authLoading, hideOthers, setHideOthers } = useAuth()

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
  const [linkSuccess, setLinkSuccess]       = useState<string | null>(null)
  const [selfLinkWarning, setSelfLinkWarning] = useState(false)
  const [restoreDialogState, setRestoreDialogState] = useState<{
    taskId: string
    newStatus: TaskStatus
    taskTitle: string
    payload: CascadeResult
    displayCascadedTasks: CascadeResult['cascadedTasks']
    blockedNowCompleted: BlockedRestorable[]
  } | null>(null)
  const [cascadingIds, setCascadingIds] = useState<Set<string>>(new Set())
  const [leavingTasks, setLeavingTasks] = useState<BoardTask[]>([])
  const [poppingContextIds, setPoppingContextIds] = useState<Set<string>>(new Set())
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set())
  const tasksSnapshot = useRef<BoardTask[]>([])
  const cascadeActiveRef = useRef(false)
  const creatingRef   = useRef(false)

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

  // Ensure every task has a details card (lazy-creates for tasks created before this feature)
  useEffect(() => {
    if (!openTaskId || !userId || !boardId) return
    const hasDetails = contextCards.some((c) => c.parentTaskId === openTaskId && c.relationType === 'details')
    if (hasDetails) return
    const parentTask = tasks.find((t) => t.id === openTaskId)
    if (!parentTask) return
    supabase.from('tasks').insert({
      user_id:               userId,
      board_id:              boardId,
      type:                  'context',
      status:                'context',
      title:                 `Details for '${parentTask.title}'`,
      question:              '',
      context_relation_type: 'details',
      parent_task_id:        openTaskId,
      position:              0,
    }).select().single().then(({ data: ctxRow }) => {
      if (ctxRow) {
        setContextCards((prev) => [
          { id: ctxRow.id, refKey: ctxRow.ref_key, title: ctxRow.title ?? '', question: '', relationType: 'details', linkType: 'blocking', priority: 'normal', labels: [], parentTaskId: openTaskId },
          ...prev,
        ])
      }
    })
  }, [openTaskId])

  useEffect(() => {
    if (!boardId) return
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` },
        () => { if (!activeId && !cascadeActiveRef.current && !creatingRef.current) loadTasks(boardId, true) },
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

  async function loadTasks(id: string, silent = false) {
    if (!silent) setLoadingTasks(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_labels(labels(name, color))')
      .eq('board_id', id)
      .order('position', { ascending: true })

    if (error) { console.error(error); setLoadingTasks(false); return }

    // Cast away the join inference type — the nested task_labels select isn't
    // reflected in the generated schema's Relationships, so TypeScript can't
    // infer it; the runtime shape is correct and accessed via `as any` below.
    const rows = (data ?? []) as any[]

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

    // Load task relationships — query by task IDs (table has no board_id column)
    const boardTaskIds = rows.filter((r) => r.status !== 'context').map((r) => r.id)
    let relRows: any[] = []
    if (boardTaskIds.length > 0) {
      const ids = boardTaskIds.join(',')
      const { data: relData, error: relErr } = await supabase
        .from('task_relationships')
        .select('*')
        .or(`from_task_id.in.(${ids}),to_task_id.in.(${ids})`)
      if (relErr) console.error('Failed to load task relationships:', relErr)
      relRows = relData ?? []
    }

    setTaskLinks(relRows.map((l: any) => ({
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
    if (!userId || !boardId || creatingRef.current) return
    creatingRef.current = true
    setModalOpen(false) // close immediately so the user can't re-submit while async work runs

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

    if (error || !row) { console.error(error); creatingRef.current = false; return }

    // Auto-create the required details card and log task creation
    const [{ error: detailsErr }, { error: logErr }] = await Promise.all([
      supabase.from('tasks').insert({
        user_id:               userId,
        board_id:              boardId,
        type:                  'context',
        status:                'context',
        title:                 `Details for '${payload.title}'`,
        question:              payload.description || '',
        context_relation_type: 'details',
        parent_task_id:        row.id,
        position:              0,
      }),
      supabase.from('activity_log').insert({
        task_id:  row.id,
        actor_id: userId,
        action:   'task_created',
      }),
    ])
    if (detailsErr) console.error('details card insert failed:', detailsErr)
    if (logErr)     console.error('activity log insert failed:', logErr)

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

    // Single authoritative refresh — avoids a race where realtime's loadTasks
    // completes between this point and a manual setTasks append, producing duplicates.
    await loadTasks(boardId, true)
    creatingRef.current = false
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

  async function handleDeleteLink(fromTaskId: string, toTaskId: string) {
    if (!boardId) return
    await supabase.from('task_relationships').delete().eq('from_task_id', fromTaskId).eq('to_task_id', toTaskId)
    await supabase.from('task_relationships').delete().eq('from_task_id', toTaskId).eq('to_task_id', fromTaskId)
    await loadTasks(boardId, true)
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
    const { fromTaskId, fromRefKey, linkType, linkLabel } = linkingState
    const inverseType = INVERSE_LINK[linkType] ?? linkType

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('task_relationships').insert({
        from_task_id: fromTaskId,
        to_task_id:   targetTask.id,
        type:         linkType as RelationshipType,
      }),
      supabase.from('task_relationships').insert({
        from_task_id: targetTask.id,
        to_task_id:   fromTaskId,
        type:         inverseType as RelationshipType,
      }),
    ])

    if (e1) console.error('Forward link insert error:', e1)
    if (e2) console.error('Inverse link insert error:', e2)

    setLinkingState(null)
    setLinkSuccess(`KAN-${fromRefKey} "${linkLabel}" ↔ KAN-${targetTask.refKey}`)
    setTimeout(() => setLinkSuccess(null), 2200)

    await loadTasks(boardId, true)
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

    // ── Completing a task ──────────────────────────────────────────────────
    if (statusChanged && activeTask.status === 'completed' && originalTask) {
      cascadeActiveRef.current = true

      const popCtx = (parentId: string) => {
        const ids = contextCards.filter((c) => c.parentTaskId === parentId).map((c) => c.id)
        if (ids.length) setPoppingContextIds((prev) => new Set([...prev, ...ids]))
      }
      popCtx(activeTaskId)

      const result = await executeCompletion(activeTaskId, undefined, (cascadedId) => {
        const leavingTask = tasksSnapshot.current.find((t) => t.id === cascadedId)
        if (leavingTask) setLeavingTasks((prev) => [...prev, leavingTask])
        setTasks((prev) => prev.map((t) => t.id === cascadedId ? { ...t, status: 'completed' } : t))
        setCascadingIds((prev) => new Set([...prev, cascadedId]))
        popCtx(cascadedId)
      })
      if (result.deletedRelationships.length > 0 || result.cascadedTasks.length > 0) {
        await supabase.from('activity_log').insert({
          task_id:  activeTaskId,
          actor_id: userId ?? null,
          action:   'task_completed_cascade',
          payload:  result as unknown as Record<string, unknown>,
        })
      }
      // Hold off DB refresh until cascade arrive/leave animations finish (750ms),
      // then clear animation state BEFORE refreshing so loadTasks doesn't re-trigger animations.
      await new Promise<void>((resolve) => setTimeout(resolve, 800))
      setCascadingIds(new Set())
      setLeavingTasks([])
      setPoppingContextIds(new Set())
      await loadTasks(boardId, true)
      cascadeActiveRef.current = false
      return
    }

    // ── Un-completing a task ───────────────────────────────────────────────
    if (statusChanged && originalTask?.status === 'completed') {
      const { data: logEntry } = await supabase
        .from('activity_log')
        .select('payload')
        .eq('task_id', activeTaskId)
        .eq('action', 'task_completed_cascade')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const cascadePayload = logEntry?.payload as CascadeResult | null
      const originalCascadedTasks = cascadePayload?.cascadedTasks ?? []
      const deletedRels = cascadePayload?.deletedRelationships ?? []

      // Issue 1: Only show cascaded tasks that are still completed in the dialog.
      // The original payload is kept intact for executeUncompletion (cascadeIds logic depends on it).
      let displayCascadedTasks = originalCascadedTasks
      if (originalCascadedTasks.length > 0) {
        const ids = originalCascadedTasks.map((t) => t.id)
        const { data: currentStatuses } = await supabase
          .from('tasks').select('id, status').in('id', ids)
        displayCascadedTasks = originalCascadedTasks.filter((t) =>
          currentStatuses?.find((s) => s.id === t.id)?.status === 'completed'
        )
      }

      // Issue 2: Find tasks that were blocked by this task and are now completed.
      // If the user restores this task, they may want to restore those blocked tasks too.
      const cascadeIdSet = new Set(originalCascadedTasks.map((t) => t.id))
      const potentialBlockedIds = deletedRels
        .filter((r) => r.from_task_id === activeTaskId && r.type === 'blocks')
        .map((r) => r.to_task_id)
        .filter((id) => !cascadeIdSet.has(id))

      let blockedNowCompleted: BlockedRestorable[] = []
      if (potentialBlockedIds.length > 0) {
        const { data: blockedTasks } = await supabase
          .from('tasks')
          .select('id, ref_key, title, status')
          .in('id', potentialBlockedIds)
          .eq('status', 'completed')
        blockedNowCompleted = (blockedTasks ?? []).map((t) => ({
          id:     t.id,
          refKey: t.ref_key,
          title:  t.title ?? '',
        }))
      }

      if (displayCascadedTasks.length > 0 || blockedNowCompleted.length > 0) {
        setRestoreDialogState({
          taskId:              activeTaskId,
          newStatus:           activeTask.status,
          taskTitle:           activeTask.title,
          payload:             cascadePayload ?? { deletedRelationships: [], cascadedTasks: [] },
          displayCascadedTasks,
          blockedNowCompleted,
        })
        return
      }

      // No dialog needed — restore directly, stripping any blocks rels for completed tasks
      const allBlockedIds = new Set(blockedNowCompleted.map((t) => t.id))
      const cleanedPayload = cascadePayload
        ? {
            ...cascadePayload,
            deletedRelationships: cascadePayload.deletedRelationships.filter(
              (r) => !allBlockedIds.has(r.from_task_id) && !allBlockedIds.has(r.to_task_id)
            ),
          }
        : { deletedRelationships: [], cascadedTasks: [] }
      await executeUncompletion(activeTaskId, activeTask.status, [], cleanedPayload)
      await loadTasks(boardId, true)
      return
    }

    // ── Normal drag / position update ──────────────────────────────────────
    const updates: PromiseLike<unknown>[] = []

    if (statusChanged) {
      updates.push(supabase.from('tasks').update({ status: activeTask.status }).eq('id', activeTaskId))
      updates.push(supabase.from('activity_log').insert({
        task_id:  activeTaskId,
        actor_id: userId ?? null,
        action:   'status_changed',
        payload:  { from: originalTask?.status, to: activeTask.status },
      }))
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

  async function handleRestoreConfirm(selectedCascadeIds: string[], selectedBlockedIds: string[]) {
    if (!restoreDialogState || !boardId) return
    const { taskId, newStatus, payload, blockedNowCompleted } = restoreDialogState
    setRestoreDialogState(null)

    // Strip blocks/blocked_by rels for completed tasks from the payload so
    // executeUncompletion doesn't re-insert them. restoreBlockedTasks handles
    // the ones the user opted to restore.
    const allBlockedIds = new Set(blockedNowCompleted.map((t) => t.id))
    const cleanedPayload = {
      ...payload,
      deletedRelationships: payload.deletedRelationships.filter(
        (r) => !allBlockedIds.has(r.from_task_id) && !allBlockedIds.has(r.to_task_id)
      ),
    }

    await executeUncompletion(taskId, newStatus, selectedCascadeIds, cleanedPayload)
    if (selectedBlockedIds.length > 0) {
      await restoreBlockedTasks(taskId, selectedBlockedIds, payload.deletedRelationships)
    }
    await loadTasks(boardId, true)
  }

  async function handleRestoreCancel() {
    if (!restoreDialogState || !boardId) return
    const { taskId, newStatus, payload, blockedNowCompleted } = restoreDialogState
    setRestoreDialogState(null)

    const allBlockedIds = new Set(blockedNowCompleted.map((t) => t.id))
    const cleanedPayload = {
      ...payload,
      deletedRelationships: payload.deletedRelationships.filter(
        (r) => !allBlockedIds.has(r.from_task_id) && !allBlockedIds.has(r.to_task_id)
      ),
    }
    await executeUncompletion(taskId, newStatus, [], cleanedPayload)
    await loadTasks(boardId, true)
  }

  async function handleAccept(taskId: string) {
    if (!userId) return
    const user = users.find((u) => u.id === userId)
    setTasks((prev) => prev.map((t) =>
      t.id === taskId
        ? { ...t, assignee: user ? { id: user.id, name: user.displayName, color: user.avatarColor } : t.assignee }
        : t
    ))
    await supabase.from('tasks').update({ assignee_id: userId }).eq('id', taskId)
  }

  /* ── Label filter ──────────────────────────────────── */
  const [boardLabels, setBoardLabels]   = useState<{ id: string; name: string; color: string }[]>([])
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [labelsOpen, setLabelsOpen]     = useState(false)
  const labelsRef                       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!boardId) return
    supabase.from('labels').select('id, name, color').eq('board_id', boardId).order('name')
      .then(({ data }) => setBoardLabels(data ?? []))
  }, [boardId])

  useEffect(() => {
    if (!labelsOpen) return
    function onDown(e: MouseEvent) {
      if (labelsRef.current && !labelsRef.current.contains(e.target as Node)) setLabelsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [labelsOpen])

  function toggleLabel(name: string) {
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  /* ── Render ────────────────────────────────────────── */
  const tasksInColumn = (status: TaskStatus) =>
    tasks.filter((t) => {
      if (t.status !== status) return false
      if (hideOthers && t.assignee && t.assignee.id !== userId) return false
      if (selectedLabels.size > 0 && !t.labels.some((l) => selectedLabels.has(l.name))) return false
      return true
    })
  const activeTask    = activeId ? tasks.find((t) => t.id === activeId) ?? null : null
  const openTask      = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null
  const isLoading     = authLoading || loadingTasks

  // Resolve task links for the open task — show both sides of each relationship row
  const openTaskLinks = openTask
    ? [
        // Rows where this task is the FROM: show the type from its own perspective
        ...taskLinks
          .filter((l) => l.fromTaskId === openTask.id)
          .map((l) => {
            const target = tasks.find((t) => t.id === l.toTaskId)
            return {
              id:           l.id,
              fromTaskId:   l.fromTaskId,
              toTaskId:     l.toTaskId,
              type:         LINK_DISPLAY[l.type]?.from ?? l.type,
              toTaskRefKey: target?.refKey ?? 0,
              toTaskTitle:  target?.title ?? '',
            }
          }),
        // Rows where this task is the TO: show the inverse label
        ...taskLinks
          .filter((l) => l.toTaskId === openTask.id)
          .map((l) => {
            const target = tasks.find((t) => t.id === l.fromTaskId)
            return {
              id:           l.id + '_r',
              fromTaskId:   l.fromTaskId,
              toTaskId:     l.toTaskId,
              type:         LINK_DISPLAY[l.type]?.to ?? l.type,
              toTaskRefKey: target?.refKey ?? 0,
              toTaskTitle:  target?.title ?? '',
            }
          }),
      ]
    : []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{boardName || 'Board'}</h1>
          <span className={styles.taskCount}>{tasks.length} tasks</span>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={`${styles.focusToggle} ${hideOthers ? styles.focusToggleOn : ''}`}
            onClick={() => setHideOthers(!hideOthers)}
            title={hideOthers ? 'Focus mode on — click to show all tasks' : 'Focus mode off — click to show only your tasks'}
          >
            <span className={styles.focusDot} />
            Focus
          </button>

          {boardLabels.length > 0 && (
            <div className={styles.labelsDropdown} ref={labelsRef}>
              <button
                type="button"
                className={`${styles.labelsBtn} ${selectedLabels.size > 0 ? styles.labelsBtnActive : ''}`}
                onClick={() => setLabelsOpen((o) => !o)}
              >
                Labels
                {selectedLabels.size > 0 && <span className={styles.labelsBadge}>{selectedLabels.size}</span>}
                <span className={styles.labelsCaret}>▾</span>
              </button>
              {labelsOpen && (
                <div className={styles.labelsPanel}>
                  {boardLabels.map((l) => {
                    const active = selectedLabels.has(l.name)
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className={`${styles.labelOption} ${active ? styles.labelOptionActive : ''}`}
                        onClick={() => toggleLabel(l.name)}
                      >
                        <span className={styles.labelOptionDot} style={{ background: l.color }} />
                        <span className={styles.labelOptionName}>{l.name}</span>
                        {active && <span className={styles.labelOptionCheck}>✓</span>}
                      </button>
                    )
                  })}
                  {selectedLabels.size > 0 && (
                    <button
                      type="button"
                      className={styles.labelsClearBtn}
                      onClick={() => { setSelectedLabels(new Set()); setLabelsOpen(false) }}
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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

      {/* Linking mode — dark backdrop (columns inside the board handle their own dimming) */}
      {linkingState && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.72)',
            pointerEvents: 'auto',
          }}
          onClick={() => setLinkingState(null)}
        />
      )}

      {/* Linking mode — instruction banner */}
      {linkingState && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 65,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 10px 9px 16px',
            background: 'rgba(10,18,32,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
            {linkingState.linkLabel}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>KAN-{linkingState.fromRefKey}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>— click a task to link</span>
          <button
            type="button"
            style={{
              marginLeft: '4px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.65)',
              fontSize: '15px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '3px 9px',
            }}
            onClick={() => setLinkingState(null)}
            aria-label="Cancel linking"
          >
            ✕
          </button>
        </div>
      )}

      {/* Self-link warning toast */}
      {selfLinkWarning && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 70,
            background: '#d97706',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          A task can't be linked to itself
        </div>
      )}

      {/* Link success banner */}
      {linkSuccess && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 65,
            background: '#16a34a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '52px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 -2px 24px rgba(22,163,74,0.5)',
            gap: '10px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '18px' }}>✓</span>
          <span>Linked — {linkSuccess}</span>
        </div>
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
            const isCollapsed = collapsedCols.has(col.key)
            const toggleCollapse = () => setCollapsedCols((prev) => {
              const next = new Set(prev)
              next.has(col.key) ? next.delete(col.key) : next.add(col.key)
              return next
            })
            return (
              <section
                key={col.key}
                className={[
                  styles.column,
                  col.key === 'in_review' && styles.inReviewColumn,
                  col.key === 'completed' && styles.completedColumn,
                  isDragTarget && styles.columnDragTarget,
                  isCollapsed && styles.columnCollapsed,
                ].filter(Boolean).join(' ')}
                style={{ ...css, ...(linkingState ? { position: 'relative' } : {}) }}
              >
                {linkingState && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    zIndex: 1, pointerEvents: 'none',
                    borderRadius: 'inherit',
                  }} />
                )}
                <div
                  className={`${styles.columnHeader} ${styles.columnHeaderClickable}`}
                  style={css}
                  onClick={toggleCollapse}
                >
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
                            const blockedCount =
                              tCtx.filter((c) => c.relationType === 'question' && c.linkType === 'blocking' && !c.answer).length +
                              taskLinks.filter((l) => l.fromTaskId === t.id && l.type === 'blocked_by').length
                            const waitingCount = tCtx.filter((c) => c.relationType === 'question' && c.linkType === 'waiting_on' && !c.answer).length
                            const isParent =
                              taskLinks.some((l) => l.fromTaskId === t.id && l.type === 'parent_of') ||
                              taskLinks.some((l) => l.toTaskId === t.id && l.type === 'subtask')
                            const isWaitingOnTask = taskLinks.some((l) => l.fromTaskId === t.id && l.type === 'waiting_on')
                            const isCompleted = t.status === 'completed'
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
                                isParent={isParent}
                                isWaitingOnTask={isWaitingOnTask}
                                isCompleted={isCompleted}
                                isCascading={cascadingIds.has(t.id)}
                                onOpen={() => {
                                  if (linkingState?.fromTaskId === t.id) {
                                    setSelfLinkWarning(true)
                                    setTimeout(() => setSelfLinkWarning(false), 2000)
                                  } else {
                                    setOpenTaskId(t.id)
                                  }
                                }}
                                isSelectable={isSelectableCard}
                                onSelect={() => handleSelectLinkTarget(t)}
                                onAccept={!t.assignee && userId ? () => handleAccept(t.id) : undefined}
                              />
                            )
                          })
                    }
                  </SortableContext>
                  {leavingTasks.filter((t) => t.status === col.key).map((t) => (
                    <div
                      key={`leaving-${t.id}`}
                      className={styles.cascadeLeaving}
                      onAnimationEnd={() => setLeavingTasks((prev) => prev.filter((x) => x.id !== t.id))}
                    >
                      <TaskCard
                        refKey={t.refKey}
                        type={t.type}
                        title={t.title}
                        priority={t.priority}
                        dueDate={t.dueDate}
                        labels={t.labels}
                        isCompleted={false}
                      />
                    </div>
                  ))}
                </ColumnBody>
              </section>
            )
          })}

          {/* Context column */}
          {(() => {
            const ctxCollapsed = collapsedCols.has('context')
            const toggleCtx = () => setCollapsedCols((prev) => { const n = new Set(prev); n.has('context') ? n.delete('context') : n.add('context'); return n })
            return (
          <section
            className={[styles.column, styles.contextColumn, ctxCollapsed && styles.columnCollapsed].filter(Boolean).join(' ')}
            style={{ '--col-accent': 'var(--color-col-context)', ...(linkingState ? { position: 'relative' } : {}) } as React.CSSProperties}
          >
            {linkingState && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.75)',
                zIndex: 1, pointerEvents: 'none',
                borderRadius: 'inherit',
              }} />
            )}
            <div
              className={`${styles.columnHeader} ${styles.columnHeaderClickable}`}
              style={{ '--col-accent': 'var(--color-col-context)' } as React.CSSProperties}
              onClick={toggleCtx}
            >
              <span className={styles.columnLabel}>Context</span>
              <span className={styles.columnCount}>{contextCards.filter((c) => {
                const p = tasks.find((t) => t.id === c.parentTaskId)
                return !(hideOthers && p?.assignee && p.assignee.id !== userId)
              }).length}</span>
            </div>
            <div className={styles.columnBody}>
              {isLoading
                ? <div className={styles.empty}>Loading…</div>
                : contextCards.length === 0
                  ? <div className={styles.empty}>No context cards</div>
                  : contextCards.map((c) => {
                      const parent = tasks.find((t) => t.id === c.parentTaskId)
                      const isPopping = poppingContextIds.has(c.id)
                      if (parent?.status === 'completed' && !isPopping && parent?.id !== activeId) return null
                      if (hideOthers && parent?.assignee && parent.assignee.id !== userId) return null
                      return (
                        <div
                          key={c.id}
                          className={isPopping ? styles.contextCardPopping : undefined}
                          onClick={isPopping ? undefined : () => setOpenContextId(c.id)}
                          style={{ cursor: isPopping ? 'default' : 'pointer' }}
                          onAnimationEnd={isPopping ? () => {
                            setContextCards((prev) => prev.filter((x) => x.id !== c.id))
                            setPoppingContextIds((prev) => { const n = new Set(prev); n.delete(c.id); return n })
                          } : undefined}
                        >
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
            )
          })()}
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

      {restoreDialogState && (
        <RestoreDialog
          taskTitle={restoreDialogState.taskTitle}
          cascadedTasks={restoreDialogState.displayCascadedTasks}
          blockedTasks={restoreDialogState.blockedNowCompleted}
          onConfirm={handleRestoreConfirm}
          onCancel={handleRestoreCancel}
        />
      )}

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
          onDeleteLink={handleDeleteLink}
          onEnterLinkMode={handleEnterLinkMode}
        />
      )}
    </div>
  )
}
