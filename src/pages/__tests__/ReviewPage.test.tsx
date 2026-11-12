import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ReviewPage from '../ReviewPage'

vi.mock('../../lib/boards', () => ({
  getBoardBySlug: vi.fn().mockResolvedValue({ id: 'board-1' }),
}))

function makeQuery(data: unknown[] = []) {
  const q: Record<string, unknown> = {}
  const chain = () => q
  q.select = chain; q.eq = chain; q.neq = chain; q.in = chain; q.order = chain
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data }).then(res)
  return q
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => makeQuery() },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/board/test-board/review']}>
      <Routes>
        <Route path="/board/:slug/review" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ReviewPage', () => {
  it('renders the page title', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /^review$/i })).toBeInTheDocument()
  })

  it('renders both chart tab buttons once loaded', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /completion over time/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /work by assignee/i })).toBeInTheDocument()
    })
  })

  it('renders summary stats once loaded', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/tasks created/i)).toBeInTheDocument()
      expect(screen.getByText(/tasks completed/i)).toBeInTheDocument()
      expect(screen.getByText(/project duration/i)).toBeInTheDocument()
    })
  })
})
