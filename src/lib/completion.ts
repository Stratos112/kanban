import { supabase } from './supabase'
import type { TaskStatus, RelationshipType } from './database.types'

export interface CascadedTask {
  id: string
  refKey: number
  title: string
  previousStatus: TaskStatus
}

export interface CascadeResult {
  deletedRelationships: Array<{
    id: string
    from_task_id: string
    to_task_id: string
    type: string
    created_at: string
  }>
  cascadedTasks: CascadedTask[]
}

export async function executeCompletion(
  taskId: string,
  visited: Set<string> = new Set(),
  onProgress?: (taskId: string) => void
): Promise<CascadeResult> {
  if (visited.has(taskId)) return { deletedRelationships: [], cascadedTasks: [] }
  visited.add(taskId)

  const result: CascadeResult = { deletedRelationships: [], cascadedTasks: [] }

  // Fetch ALL rows involving this task (both directions) before deleting
  const { data: allRels } = await supabase
    .from('task_relationships')
    .select('*')
    .or(`from_task_id.eq.${taskId},to_task_id.eq.${taskId}`)

  for (const r of allRels ?? []) {
    result.deletedRelationships.push({
      id: r.id,
      from_task_id: r.from_task_id,
      to_task_id: r.to_task_id,
      type: r.type,
      created_at: r.created_at,
    })
  }

  await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
  await supabase.from('task_relationships').delete().eq('from_task_id', taskId)
  await supabase.from('task_relationships').delete().eq('to_task_id', taskId)

  // Process cascades from forward relationships only
  for (const rel of (allRels ?? []).filter((r) => r.from_task_id === taskId)) {
    if (rel.type === 'completes' || rel.type === 'parent_of') {
      await cascadeComplete(rel.to_task_id, visited, result, onProgress)
    } else if (rel.type === 'child_of' || rel.type === 'subtask') {
      await maybeCompleteParent(rel.to_task_id, visited, result, onProgress)
    }
    // 'blocks', 'blocked_by', 'waiting_on', 'details' — deleted, no cascade
  }

  return result
}

async function cascadeComplete(
  targetId: string,
  visited: Set<string>,
  result: CascadeResult,
  onProgress?: (taskId: string) => void
): Promise<void> {
  if (visited.has(targetId)) return

  const { data: target } = await supabase
    .from('tasks')
    .select('id, ref_key, title, status')
    .eq('id', targetId)
    .single()

  if (!target || target.status === 'completed') return

  if (!result.cascadedTasks.find((t) => t.id === targetId)) {
    result.cascadedTasks.push({
      id: target.id,
      refKey: target.ref_key,
      title: target.title ?? '',
      previousStatus: target.status as TaskStatus,
    })
  }

  // Notify before recursing so the UI can animate this task immediately
  onProgress?.(targetId)

  const sub = await executeCompletion(targetId, visited, onProgress)
  for (const r of sub.deletedRelationships) {
    if (!result.deletedRelationships.find((x) => x.id === r.id)) {
      result.deletedRelationships.push(r)
    }
  }
  for (const t of sub.cascadedTasks) {
    if (!result.cascadedTasks.find((x) => x.id === t.id)) {
      result.cascadedTasks.push(t)
    }
  }
}

async function maybeCompleteParent(
  parentId: string,
  visited: Set<string>,
  result: CascadeResult,
  onProgress?: (taskId: string) => void
): Promise<void> {
  if (visited.has(parentId)) return

  // Check remaining incomplete children (child_of and subtask, from child's perspective)
  const { data: childRels } = await supabase
    .from('task_relationships')
    .select('from_task_id')
    .eq('to_task_id', parentId)
    .in('type', ['child_of', 'subtask'])

  if (childRels && childRels.length > 0) {
    const childIds = childRels.map((r) => r.from_task_id)
    const { data: incomplete } = await supabase
      .from('tasks')
      .select('id')
      .in('id', childIds)
      .neq('status', 'completed')
    if (incomplete && incomplete.length > 0) return
  }

  await cascadeComplete(parentId, visited, result, onProgress)
}

// Restore tasks that were blocked by `restoringTaskId` and are being re-blocked.
// Resets their status to in_progress and re-inserts the blocks/blocked_by relationships.
export async function restoreBlockedTasks(
  restoringTaskId: string,
  blockedTaskIds: string[],
  deletedRelationships: CascadeResult['deletedRelationships']
): Promise<void> {
  if (blockedTaskIds.length === 0) return
  for (const taskId of blockedTaskIds) {
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
  }
  const seen = new Set<string>()
  for (const rel of deletedRelationships) {
    if (seen.has(rel.id)) continue
    if (
      (rel.from_task_id === restoringTaskId && blockedTaskIds.includes(rel.to_task_id)) ||
      (blockedTaskIds.includes(rel.from_task_id) && rel.to_task_id === restoringTaskId)
    ) {
      seen.add(rel.id)
      await supabase.from('task_relationships').insert({
        from_task_id: rel.from_task_id,
        to_task_id: rel.to_task_id,
        type: rel.type as RelationshipType,
      })
    }
  }
}

export async function executeUncompletion(
  taskId: string,
  newStatus: TaskStatus,
  selectedTaskIds: string[],
  payload: CascadeResult
): Promise<void> {
  const cascadeIds = new Set(payload.cascadedTasks.map((t) => t.id))
  const restoredIds = new Set([taskId, ...selectedTaskIds])

  await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)

  for (const task of payload.cascadedTasks) {
    if (restoredIds.has(task.id)) {
      await supabase.from('tasks').update({ status: task.previousStatus }).eq('id', task.id)
    }
  }

  // Re-insert relationships — any cascade-task endpoint must be in restoredIds
  const seen = new Set<string>()
  for (const rel of payload.deletedRelationships) {
    if (seen.has(rel.id)) continue
    seen.add(rel.id)

    if (cascadeIds.has(rel.from_task_id) && !restoredIds.has(rel.from_task_id)) continue
    if (cascadeIds.has(rel.to_task_id) && !restoredIds.has(rel.to_task_id)) continue

    await supabase.from('task_relationships').insert({
      from_task_id: rel.from_task_id,
      to_task_id: rel.to_task_id,
      type: rel.type as RelationshipType,
    })
  }
}
