import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../test/renderWithRouter'
import BoardPage from '../BoardPage'

const COLUMNS = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Completed', 'Context']

describe('BoardPage', () => {
  it('renders all six column headings', () => {
    renderWithRouter(<BoardPage />)
    for (const label of COLUMNS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders the page title', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('heading', { name: /board/i })).toBeInTheDocument()
  })

  it('renders the New Task button', () => {
    renderWithRouter(<BoardPage />)
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument()
  })

  it('renders task cards in columns', () => {
    renderWithRouter(<BoardPage />)
    // Mock data includes tasks — at least one card title should be visible
    expect(screen.getByText(/drag-and-drop board/i)).toBeInTheDocument()
  })

  it('renders context cards in the Context column', () => {
    renderWithRouter(<BoardPage />)
    // Mock context card question
    expect(screen.getByText(/should we support custom columns/i)).toBeInTheDocument()
  })
})
