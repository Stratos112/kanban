import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../test/renderWithRouter'
import App from '../App'

describe('App routing', () => {
  it('renders BoardPage at /', () => {
    renderWithRouter(<App />, { initialPath: '/' })
    expect(screen.getByRole('heading', { name: /^board$/i })).toBeInTheDocument()
  })

  it('renders ProfilePage at /profile', () => {
    renderWithRouter(<App />, { initialPath: '/profile' })
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument()
  })

  it('renders ReviewPage at /review', () => {
    renderWithRouter(<App />, { initialPath: '/review' })
    expect(screen.getByRole('heading', { name: /^review$/i })).toBeInTheDocument()
  })

  it('redirects unknown paths to /', () => {
    renderWithRouter(<App />, { initialPath: '/does-not-exist' })
    expect(screen.getByRole('heading', { name: /^board$/i })).toBeInTheDocument()
  })

  it('renders the sidebar on every route', () => {
    renderWithRouter(<App />, { initialPath: '/review' })
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
