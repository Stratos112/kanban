import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../test/renderWithRouter'
import App from '../App'

describe('App routing', () => {
  it('renders BoardPage at /board/test', () => {
    renderWithRouter(<App />, { initialPath: '/board/test' })
    expect(screen.getByRole('heading', { name: /^board$/i })).toBeInTheDocument()
  })

  it('renders ProfilePage at /board/test/profile', () => {
    renderWithRouter(<App />, { initialPath: '/board/test/profile' })
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument()
  })

  it('renders ReviewPage at /board/test/review', () => {
    renderWithRouter(<App />, { initialPath: '/board/test/review' })
    expect(screen.getByRole('heading', { name: /^review$/i })).toBeInTheDocument()
  })

  it('redirects unknown paths to / showing board list', () => {
    renderWithRouter(<App />, { initialPath: '/does-not-exist' })
    expect(screen.getByRole('button', { name: /new board/i })).toBeInTheDocument()
  })

  it('renders the sidebar on board routes', () => {
    renderWithRouter(<App />, { initialPath: '/board/test/review' })
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
