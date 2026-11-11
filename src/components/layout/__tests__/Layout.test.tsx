import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../../test/renderWithRouter'
import Layout from '../Layout'

describe('Layout', () => {
  it('renders children', () => {
    renderWithRouter(<Layout><p>hello</p></Layout>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('renders the sidebar alongside children', () => {
    renderWithRouter(<Layout><p>content</p></Layout>)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
