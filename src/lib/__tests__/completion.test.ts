import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { executeCompletion, executeUncompletion, restoreBlockedTasks } from '../completion'
import type { CascadeResult, CascadedTask } from '../completion'
import { supabase } from '../supabase'

const mockFrom = vi.mocked(supabase.from)

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

type TaskRow = { id: string; ref_key: number; title: string; status: string }
type RelRow = { id: string; from_task_id: string; to_task_id: string; type: string; created_at: string }

function setupMock(tasks: TaskRow[], rels: RelRow[]) {
  const taskUpdates: Array<{ id: string; [k: string]: unknown }> = []
  const relInserts: unknown[] = []

  mockFrom.mockImplementation((table: string) => {
    if (table === 'tasks') {
      return {
        update(data: Record<string, unknown>) {
          return {
            eq(_field: string, value: string) {
              taskUpdates.push({ id: value, ...data })
              return Promise.resolve({ error: null })
            },
          }
        },
        select(_cols?: string) {
          return {
            eq(_field: string, value: string) {
              return {
                single() {
                  const task = tasks.find((t) => t.id === value) ?? null
                  return Promise.resolve({ data: task, error: null })
                },
                in(field2: string, values: string[]) {
                  // used by maybeCompleteParent: .in('id', childIds).neq('status', 'completed')
                  const filtered = tasks.filter(
                    (t) => values.includes((t as Record<string, unknown>)[field2] as string),
                  )
                  return {
                    neq(_f: string, val: string) {
                      return Promise.resolve({
                        data: filtered.filter((t) => t.status !== val),
                        error: null,
                      })
                    },
                  }
                },
              }
            },
            in(_field: string, _values: string[]) {
              // tasks.select().in() — not used in current paths
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
        delete() {
          return { eq() { return Promise.resolve({ error: null }) } }
        },
      } as never
    }

    if (table === 'task_relationships') {
      return {
        select(_cols?: string) {
          return {
            or(filter: string) {
              // e.g. "from_task_id.eq.A,to_task_id.eq.A"
              const match = filter.match(/from_task_id\.eq\.([^,]+)/)
              const taskId = match?.[1]
              const matched = rels.filter(
                (r) => r.from_task_id === taskId || r.to_task_id === taskId,
              )
              return Promise.resolve({ data: matched, error: null })
            },
            eq(_field: string, value: string) {
              return {
                in(field2: string, values: string[]) {
                  // maybeCompleteParent: .select('from_task_id').eq('to_task_id', parentId).in('type', [...])
                  const matched = rels.filter(
                    (r) =>
                      r.to_task_id === value &&
                      values.includes((r as Record<string, unknown>)[field2] as string),
                  )
                  return Promise.resolve({
                    data: matched.map((r) => ({ from_task_id: r.from_task_id })),
                    error: null,
                  })
                },
              }
            },
          }
        },
        delete() {
          return {
            eq() {
              return Promise.resolve({ error: null })
            },
          }
        },
        insert(data: unknown) {
          relInserts.push(data)
          return Promise.resolve({ error: null })
        },
      } as never
    }

    // fallback
    return {} as never
  })

  return { taskUpdates, relInserts }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskRow> & { id: string }): TaskRow {
  return {
    ref_key: 1,
    title: 'Task',
    status: 'in_progress',
    ...overrides,
  }
}

function makeRel(overrides: Partial<RelRow> & { from_task_id: string; to_task_id: string; type: string }): RelRow {
  return {
    id: `${overrides.from_task_id}-${overrides.to_task_id}`,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// executeCompletion
// ---------------------------------------------------------------------------

describe('executeCompletion', () => {
  it('marks the main task as completed', async () => {
    const { taskUpdates } = setupMock([makeTask({ id: 'A' })], [])

    await executeCompletion('A')

    expect(taskUpdates).toContainEqual({ id: 'A', status: 'completed' })
  })

  it('cascades via completes relationship: target gets completed and onProgress is called', async () => {
    const tasks = [
      makeTask({ id: 'A', title: 'Task A', ref_key: 1 }),
      makeTask({ id: 'B', title: 'Task B', ref_key: 2, status: 'in_progress' }),
    ]
    const rels = [makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'completes' })]
    const { taskUpdates } = setupMock(tasks, rels)
    const onProgress = vi.fn()

    await executeCompletion('A', new Set(), onProgress)

    expect(taskUpdates).toContainEqual({ id: 'B', status: 'completed' })
    expect(onProgress).toHaveBeenCalledWith('B')
  })

  it('includes cascaded task in result.cascadedTasks with its previousStatus', async () => {
    const tasks = [
      makeTask({ id: 'A', title: 'Task A', ref_key: 1 }),
      makeTask({ id: 'B', title: 'Task B', ref_key: 2, status: 'in_progress' }),
    ]
    const rels = [makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'completes' })]
    setupMock(tasks, rels)

    const result = await executeCompletion('A')

    expect(result.cascadedTasks).toContainEqual(
      expect.objectContaining({ id: 'B', previousStatus: 'in_progress' }),
    )
  })

  it('includes deleted relationships in result.deletedRelationships', async () => {
    const tasks = [makeTask({ id: 'A' })]
    const rels = [makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'blocks' })]
    setupMock(tasks, rels)

    const result = await executeCompletion('A')

    expect(result.deletedRelationships).toContainEqual(expect.objectContaining({ id: 'rel-1' }))
  })

  it('does NOT cascade via blocks relationship: blocked task stays at its status and onProgress is not called', async () => {
    const tasks = [
      makeTask({ id: 'A' }),
      makeTask({ id: 'B', status: 'ready' }),
    ]
    const rels = [makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'blocks' })]
    const { taskUpdates } = setupMock(tasks, rels)
    const onProgress = vi.fn()

    await executeCompletion('A', new Set(), onProgress)

    expect(taskUpdates.some((u) => u.id === 'B')).toBe(false)
    expect(onProgress).not.toHaveBeenCalledWith('B')
  })
})

// ---------------------------------------------------------------------------
// executeUncompletion
// ---------------------------------------------------------------------------

describe('executeUncompletion', () => {
  it('restores the main task to its newStatus', async () => {
    const { taskUpdates } = setupMock([], [])
    const payload: CascadeResult = { cascadedTasks: [], deletedRelationships: [] }

    await executeUncompletion('A', 'in_progress', [], payload)

    expect(taskUpdates).toContainEqual({ id: 'A', status: 'in_progress' })
  })

  it('restores a selected cascade task to its previousStatus', async () => {
    const { taskUpdates } = setupMock([], [])
    const cascadedTasks: CascadedTask[] = [
      { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'ready' },
    ]
    const payload: CascadeResult = { cascadedTasks, deletedRelationships: [] }

    await executeUncompletion('A', 'in_progress', ['B'], payload)

    expect(taskUpdates).toContainEqual({ id: 'B', status: 'ready' })
  })

  it('does NOT restore a cascade task that is not in selectedTaskIds', async () => {
    const { taskUpdates } = setupMock([], [])
    const cascadedTasks: CascadedTask[] = [
      { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'ready' },
    ]
    const payload: CascadeResult = { cascadedTasks, deletedRelationships: [] }

    // B is NOT selected
    await executeUncompletion('A', 'in_progress', [], payload)

    expect(taskUpdates.some((u) => u.id === 'B')).toBe(false)
  })

  it('re-inserts a relationship where BOTH endpoints are in restoredIds', async () => {
    const { relInserts } = setupMock([], [])
    const cascadedTasks: CascadedTask[] = [
      { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'in_progress' },
    ]
    const rel = makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'completes' })
    const payload: CascadeResult = { cascadedTasks, deletedRelationships: [rel] }

    await executeUncompletion('A', 'in_progress', ['B'], payload)

    expect(relInserts).toContainEqual(
      expect.objectContaining({ from_task_id: 'A', to_task_id: 'B' }),
    )
  })

  it('does NOT re-insert a relationship where the cascade-task endpoint is NOT in restoredIds', async () => {
    const { relInserts } = setupMock([], [])
    const cascadedTasks: CascadedTask[] = [
      { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'in_progress' },
    ]
    const rel = makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'completes' })
    const payload: CascadeResult = { cascadedTasks, deletedRelationships: [rel] }

    // B is NOT selected → not in restoredIds
    await executeUncompletion('A', 'in_progress', [], payload)

    expect(relInserts.some((r) => (r as Record<string, unknown>).to_task_id === 'B')).toBe(false)
  })

  it('always re-inserts a relationship where NEITHER endpoint is a cascade task', async () => {
    const { relInserts } = setupMock([], [])
    const cascadedTasks: CascadedTask[] = [
      { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'in_progress' },
    ]
    // A blocks C — C is not a cascade task at all
    const rel = makeRel({ id: 'rel-2', from_task_id: 'A', to_task_id: 'C', type: 'blocks' })
    const payload: CascadeResult = { cascadedTasks, deletedRelationships: [rel] }

    await executeUncompletion('A', 'in_progress', [], payload)

    expect(relInserts).toContainEqual(
      expect.objectContaining({ from_task_id: 'A', to_task_id: 'C' }),
    )
  })

  it('skips duplicate relationship ids via the seen set', async () => {
    const { relInserts } = setupMock([], [])
    const rel = makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'C', type: 'blocks' })
    const payload: CascadeResult = {
      cascadedTasks: [],
      // same id twice
      deletedRelationships: [rel, { ...rel }],
    }

    await executeUncompletion('A', 'in_progress', [], payload)

    const insertedWithRelId = relInserts.filter(
      (r) => (r as Record<string, unknown>).from_task_id === 'A' &&
              (r as Record<string, unknown>).to_task_id === 'C',
    )
    expect(insertedWithRelId).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// restoreBlockedTasks
// ---------------------------------------------------------------------------

describe('restoreBlockedTasks', () => {
  it('no-ops when blockedTaskIds is empty', async () => {
    const { taskUpdates, relInserts } = setupMock([], [])

    await restoreBlockedTasks('A', [], [])

    expect(taskUpdates).toHaveLength(0)
    expect(relInserts).toHaveLength(0)
  })

  it('updates each selected blocked task to in_progress', async () => {
    const { taskUpdates } = setupMock([], [])

    await restoreBlockedTasks('A', ['B', 'C'], [])

    expect(taskUpdates).toContainEqual({ id: 'B', status: 'in_progress' })
    expect(taskUpdates).toContainEqual({ id: 'C', status: 'in_progress' })
  })

  it('re-inserts a blocks relationship where from_task_id === restoringTaskId and to_task_id is selected', async () => {
    const { relInserts } = setupMock([], [])
    const rel = makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'blocks' })

    await restoreBlockedTasks('A', ['B'], [rel])

    expect(relInserts).toContainEqual(
      expect.objectContaining({ from_task_id: 'A', to_task_id: 'B', type: 'blocks' }),
    )
  })

  it('re-inserts a blocked_by relationship where from_task_id is selected and to_task_id === restoringTaskId', async () => {
    const { relInserts } = setupMock([], [])
    const rel = makeRel({ id: 'rel-2', from_task_id: 'B', to_task_id: 'A', type: 'blocked_by' })

    await restoreBlockedTasks('A', ['B'], [rel])

    expect(relInserts).toContainEqual(
      expect.objectContaining({ from_task_id: 'B', to_task_id: 'A', type: 'blocked_by' }),
    )
  })

  it('does NOT re-insert a relationship where the other endpoint is not in blockedTaskIds', async () => {
    const { relInserts } = setupMock([], [])
    // A blocks D, but D is not in blockedTaskIds
    const rel = makeRel({ id: 'rel-3', from_task_id: 'A', to_task_id: 'D', type: 'blocks' })

    await restoreBlockedTasks('A', ['B'], [rel])

    expect(relInserts.some((r) => (r as Record<string, unknown>).to_task_id === 'D')).toBe(false)
  })

  it('deduplicates: same relationship id appearing twice → only one insert', async () => {
    const { relInserts } = setupMock([], [])
    const rel = makeRel({ id: 'rel-1', from_task_id: 'A', to_task_id: 'B', type: 'blocks' })

    await restoreBlockedTasks('A', ['B'], [rel, { ...rel }])

    const insertedForB = relInserts.filter(
      (r) => (r as Record<string, unknown>).to_task_id === 'B',
    )
    expect(insertedForB).toHaveLength(1)
  })
})
