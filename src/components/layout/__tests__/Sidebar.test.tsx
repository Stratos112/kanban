import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../../test/renderWithRouter'
import Sidebar from '../Sidebar'

describe('Sidebar', () => {
  it('renders all three nav links', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('link', { name: /board/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review/i })).toBeInTheDocument()
  })

  it('Board link points to /', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('link', { name: /board/i })).toHaveAttribute('href', '/')
  })

  it('Profile link points to /profile', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile')
  })

  it('Review link points to /review', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/review')
  })

  it('renders the logo mark', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('marks the Board link active when on /', () => {
    renderWithRouter(<Sidebar />, { initialPath: '/' })
    const boardLink = screen.getByRole('link', { name: /board/i })
    // NavLink adds aria-current="page" when active
    expect(boardLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks the Profile link active when on /profile', () => {
    renderWithRouter(<Sidebar />, { initialPath: '/profile' })
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Board active when on /profile', () => {
    renderWithRouter(<Sidebar />, { initialPath: '/profile' })
    expect(screen.getByRole('link', { name: /board/i })).not.toHaveAttribute('aria-current')
  })
})
