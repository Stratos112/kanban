import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Sidebar from '../Sidebar'

function renderSidebar(initialPath = '/board/test') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/board/:slug/*" element={<Sidebar />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders all three nav links', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /^board$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review/i })).toBeInTheDocument()
  })

  it('Board link points to /board/test', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /^board$/i })).toHaveAttribute('href', '/board/test')
  })

  it('Profile link points to /board/test/profile', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/board/test/profile')
  })

  it('Review link points to /board/test/review', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/board/test/review')
  })

  it('renders the logo mark', () => {
    renderSidebar()
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('marks the Board link active when on /board/test', () => {
    renderSidebar('/board/test')
    const boardLink = screen.getByRole('link', { name: /^board$/i })
    expect(boardLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks the Profile link active when on /board/test/profile', () => {
    renderSidebar('/board/test/profile')
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Board active when on /board/test/profile', () => {
    renderSidebar('/board/test/profile')
    expect(screen.getByRole('link', { name: /^board$/i })).not.toHaveAttribute('aria-current')
  })
})
