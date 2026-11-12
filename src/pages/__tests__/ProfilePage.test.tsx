import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../test/renderWithRouter'
import ProfilePage from '../ProfilePage'

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', display_name: 'Guest', avatar_color: '#6366f1', created_at: '' },
    userId: 'user-1',
    loading: false,
  }),
}))

describe('ProfilePage', () => {
  it('renders the page title', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument()
  })

  it('renders the display name input defaulting to Guest', () => {
    renderWithRouter(<ProfilePage />)
    const input = screen.getByRole('textbox', { name: /display name/i })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Guest')
  })

  it('renders all three stat labels', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText(/assigned/i)).toBeInTheDocument()
    expect(screen.getByText(/completed/i)).toBeInTheDocument()
    expect(screen.getByText(/questions asked/i)).toBeInTheDocument()
  })

  it('renders the recent activity section', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument()
  })

  it('shows empty activity state when no activity exists', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
  })
})
