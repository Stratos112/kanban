import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../test/renderWithRouter'
import ReviewPage from '../ReviewPage'

const CHART_TITLES = [
  /status snapshot/i,
  /completion over time/i,
  /work by assignee/i,
  /label breakdown/i,
]

describe('ReviewPage', () => {
  it('renders the page title', () => {
    renderWithRouter(<ReviewPage />)
    expect(screen.getByRole('heading', { name: /^review$/i })).toBeInTheDocument()
  })

  it('renders all four chart card headings', () => {
    renderWithRouter(<ReviewPage />)
    for (const title of CHART_TITLES) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('renders chart placeholder labels', () => {
    renderWithRouter(<ReviewPage />)
    expect(screen.getByText(/tasks by column/i)).toBeInTheDocument()
    expect(screen.getByText(/completed per day/i)).toBeInTheDocument()
    expect(screen.getByText(/open vs\. completed/i)).toBeInTheDocument()
    expect(screen.getByText(/tasks per label/i)).toBeInTheDocument()
  })
})
