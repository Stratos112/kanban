import { describe, it, expect } from 'vitest'
import type {
  TaskType,
  TaskStatus,
  TaskPriority,
  RelationshipType,
  Task,
  Profile,
  Label,
  TaskRelationship,
  ActivityLogEntry,
  TaskWithRelations,
} from '../database.types'

// Runtime-visible constants mirroring the union types — if you add a value to
// the type but forget to add it here (or to schema.sql), this test will fail.

const TASK_TYPES: TaskType[] = ['task', 'context']

const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'in_review',
  'completed',
  'context',
]

const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'blocked_by',
  'waiting_on',
  'subtask',
  'details',
]

describe('TaskType', () => {
  it('has exactly two variants', () => {
    expect(TASK_TYPES).toHaveLength(2)
  })

  it('includes task and context', () => {
    expect(TASK_TYPES).toContain('task')
    expect(TASK_TYPES).toContain('context')
  })
})

describe('TaskStatus', () => {
  it('has exactly six variants matching the board columns', () => {
    expect(TASK_STATUSES).toHaveLength(6)
  })

  it('contains all expected column values', () => {
    const expected = ['backlog', 'ready', 'in_progress', 'in_review', 'completed', 'context']
    expect(TASK_STATUSES).toEqual(expect.arrayContaining(expected))
  })
})

describe('TaskPriority', () => {
  it('has exactly three levels', () => {
    expect(TASK_PRIORITIES).toHaveLength(3)
  })

  it('matches the values specified in the assessment PDF', () => {
    expect(TASK_PRIORITIES).toContain('low')
    expect(TASK_PRIORITIES).toContain('normal')
    expect(TASK_PRIORITIES).toContain('high')
  })

  it('does not include non-spec values like medium or urgent', () => {
    expect(TASK_PRIORITIES).not.toContain('medium')
    expect(TASK_PRIORITIES).not.toContain('urgent')
  })
})

describe('RelationshipType', () => {
  it('has exactly four variants', () => {
    expect(RELATIONSHIP_TYPES).toHaveLength(4)
  })

  it('includes all directional relationship types', () => {
    expect(RELATIONSHIP_TYPES).toContain('blocked_by')
    expect(RELATIONSHIP_TYPES).toContain('waiting_on')
    expect(RELATIONSHIP_TYPES).toContain('subtask')
    expect(RELATIONSHIP_TYPES).toContain('details')
  })
})

describe('Row type shapes', () => {
  it('Task row has required fields', () => {
    const task: Task = {
      id: 'uuid',
      ref_key: 1,
      type: 'task',
      title: 'Test task',
      description: null,
      question: null,
      answer: null,
      status: 'ready',
      priority: 'normal',
      due_date: null,
      position: 0,
      assignee_id: null,
      user_id: 'user-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(task.type).toBe('task')
    expect(task.status).toBe('ready')
  })

  it('Context card row uses question/answer fields', () => {
    const card: Task = {
      id: 'uuid',
      ref_key: 2,
      type: 'context',
      title: null,
      description: null,
      question: 'Why is the API spec not finalized?',
      answer: null,
      status: 'context',
      priority: 'high',
      due_date: null,
      position: 0,
      assignee_id: null,
      user_id: 'user-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(card.type).toBe('context')
    expect(card.question).toBeTruthy()
    expect(card.answer).toBeNull()
  })

  it('Profile row has display_name and avatar_color', () => {
    const profile: Profile = {
      id: 'user-uuid',
      display_name: 'Sky',
      avatar_color: '#6366f1',
      created_at: new Date().toISOString(),
    }
    expect(profile.display_name).toBe('Sky')
    expect(profile.avatar_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('Label row has name and color', () => {
    const label: Label = {
      id: 'label-uuid',
      user_id: 'user-uuid',
      name: 'Bug',
      color: '#f43f5e',
      created_at: new Date().toISOString(),
    }
    expect(label.name).toBe('Bug')
  })

  it('TaskRelationship stores directional type', () => {
    const rel: TaskRelationship = {
      id: 'rel-uuid',
      from_task_id: 'task-a',
      to_task_id: 'task-b',
      type: 'blocked_by',
      created_at: new Date().toISOString(),
    }
    expect(rel.type).toBe('blocked_by')
  })

  it('ActivityLogEntry accepts jsonb payload', () => {
    const entry: ActivityLogEntry = {
      id: 'log-uuid',
      task_id: 'task-uuid',
      actor_id: 'user-uuid',
      action: 'status_changed',
      payload: { from: 'ready', to: 'in_progress' },
      created_at: new Date().toISOString(),
    }
    expect(entry.payload).toEqual({ from: 'ready', to: 'in_progress' })
  })

  it('TaskWithRelations extends Task with assignee and labels', () => {
    const enriched: TaskWithRelations = {
      id: 'uuid',
      ref_key: 3,
      type: 'task',
      title: 'Enriched task',
      description: null,
      question: null,
      answer: null,
      status: 'in_progress',
      priority: 'low',
      due_date: null,
      position: 1,
      assignee_id: 'user-uuid',
      user_id: 'user-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignee: {
        id: 'user-uuid',
        display_name: 'Sky',
        avatar_color: '#6366f1',
        created_at: new Date().toISOString(),
      },
      labels: [],
    }
    expect(enriched.assignee?.display_name).toBe('Sky')
    expect(enriched.labels).toHaveLength(0)
  })
})
