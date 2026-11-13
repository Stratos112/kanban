import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { getBoardBySlug, createBoard, listBoards, renameBoard } from '../boards'
import { supabase } from '../supabase'

const mockFrom = vi.mocked(supabase.from)

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// getBoardBySlug
// ---------------------------------------------------------------------------
describe('getBoardBySlug', () => {
  it('queries the boards table filtering by invite_code', async () => {
    const board = { id: 'b1', name: 'Sprint', invite_code: 'sprint-ab12', created_at: '' }
    const single = vi.fn().mockResolvedValue({ data: board, error: null })
    const eq     = vi.fn().mockReturnValue({ single })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) } as never)

    const result = await getBoardBySlug('sprint-ab12')

    expect(mockFrom).toHaveBeenCalledWith('boards')
    expect(eq).toHaveBeenCalledWith('invite_code', 'sprint-ab12')
    expect(result).toEqual(board)
  })

  it('returns null when no matching board exists', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq     = vi.fn().mockReturnValue({ single })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) } as never)

    const result = await getBoardBySlug('ghost')

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createBoard
// ---------------------------------------------------------------------------
describe('createBoard', () => {
  function mockInsert(returnData: object) {
    const single = vi.fn().mockResolvedValue({ data: returnData, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mockFrom.mockReturnValue({ insert } as never)
    return insert
  }

  it('inserts with the board name and a slugified invite_code', async () => {
    const board = { id: 'b1', name: 'Sprint 1', invite_code: 'sprint-1-ab12', created_at: '' }
    const insert = mockInsert(board)

    await createBoard('Sprint 1')

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sprint 1',
      invite_code: expect.stringMatching(/^sprint-1-[a-z0-9]{4}$/),
    }))
  })

  it('converts spaces and special characters to hyphens in the slug', async () => {
    const board = { id: 'b2', name: 'My Epic Board!!', invite_code: 'my-epic-board-zz99', created_at: '' }
    const insert = mockInsert(board)

    await createBoard('My Epic Board!!')

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      invite_code: expect.stringMatching(/^my-epic-board-[a-z0-9]{4}$/),
    }))
  })

  it('falls back to "New Board" name and "new-board-XXXX" slug for empty input', async () => {
    const board = { id: 'b3', name: 'New Board', invite_code: 'new-board-ab12', created_at: '' }
    const insert = mockInsert(board)

    await createBoard('')

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Board',
      invite_code: expect.stringMatching(/^new-board-[a-z0-9]{4}$/),
    }))
  })

  it('truncates very long names to 32 characters in the slug', async () => {
    const longName = 'A'.repeat(80)
    const board = { id: 'b4', name: longName, invite_code: 'a-ab12', created_at: '' }
    const insert = mockInsert(board)

    await createBoard(longName)

    const call = insert.mock.calls[0][0] as { invite_code: string }
    // slug = lowercased name (up to 32 chars) + '-' + 4-char suffix = max 37 chars
    expect(call.invite_code.length).toBeLessThanOrEqual(37)
  })

  it('returns the board data from Supabase', async () => {
    const board = { id: 'b5', name: 'My Board', invite_code: 'my-board-ab12', created_at: '' }
    mockInsert(board)

    const result = await createBoard('My Board')

    expect(result).toEqual(board)
  })
})

// ---------------------------------------------------------------------------
// listBoards
// ---------------------------------------------------------------------------
describe('listBoards', () => {
  it('queries boards ordered by created_at descending', async () => {
    const boards = [
      { id: 'b2', name: 'Board B', created_at: '2026-11-13' },
      { id: 'b1', name: 'Board A', created_at: '2026-11-12' },
    ]
    const order  = vi.fn().mockResolvedValue({ data: boards, error: null })
    const select = vi.fn().mockReturnValue({ order })
    mockFrom.mockReturnValue({ select } as never)

    const result = await listBoards()

    expect(mockFrom).toHaveBeenCalledWith('boards')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(boards)
  })

  it('returns an empty array when there are no boards', async () => {
    const order  = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn().mockReturnValue({ order })
    mockFrom.mockReturnValue({ select } as never)

    const result = await listBoards()

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// renameBoard
// ---------------------------------------------------------------------------
describe('renameBoard', () => {
  it('calls update with the new name filtered by board id', async () => {
    const eq     = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ update } as never)

    await renameBoard('b1', 'Renamed Board')

    expect(mockFrom).toHaveBeenCalledWith('boards')
    expect(update).toHaveBeenCalledWith({ name: 'Renamed Board' })
    expect(eq).toHaveBeenCalledWith('id', 'b1')
  })
})
