import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../test/renderWithRouter'
import BoardPage from '../BoardPage'

// ---------------------------------------------------------------------------
// Supabase stub — returns empty data for all queries
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase', () => {
  const makeChain = () => {
    const resolved = Promise.resolve({ data: [], error: null })
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'or', 'in', 'insert', 'update', 'delete', 'order', 'single', 'filter']) {
      chain[m] = vi.fn().mockReturnValue(Object.assign(Object.create(resolved), chain))
    }
    Object.assign(chain, { then: resolved.then.bind(resolved), catch: resolved.catch.bind(resolved) })
    return chain
  }
  return {
    supabase: {
      from:    vi.fn().mockImplementation(() => makeChain()),
      channel: vi.fn().mockReturnValue({
        on:        vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('../../lib/boards', () => ({
  getBoardBySlug: vi.fn().mockResolvedValue({ id: 'board-1', name: 'Test Board' }),
}))

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({
    userId:          'u1',
    loading:         false,
    hideOthers:      false,
    setHideOthers:   vi.fn(),
    teammateIds:     new Set<string>(),
  }),
}))

const COLUMNS = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Completed', 'Context']

// ---------------------------------------------------------------------------
// Column structure
// ---------------------------------------------------------------------------
describe('BoardPage — column structure', () => {
  it('renders all six column headings', () => {
    renderWithRouter(<BoardPage />)
    for (const label of COLUMNS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders a New Task button', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
describe('BoardPage — search', () => {
  it('renders a search input', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('search input starts empty', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})

// ---------------------------------------------------------------------------
// Focus mode toggle
// ---------------------------------------------------------------------------
describe('BoardPage — focus mode toggle', () => {
  it('renders the focus mode toggle button', () => {
    renderWithRouter(<BoardPage />)
    // button has title="Focus mode off — ..." and text "Global" when hideOthers is false
    expect(screen.getByTitle(/focus mode/i)).toBeInTheDocument()
  })

  it('shows "Global" when hideOthers is false', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('button', { name: /global/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Task count badge
// ---------------------------------------------------------------------------
describe('BoardPage — task count', () => {
  it('shows "0 tasks" when the board is empty', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByText('0 tasks')).toBeInTheDocument()
  })
})
