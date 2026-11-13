import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskCard from '../TaskCard'

// Fixed "now" = 2026-11-13 noon UTC
const NOW = new Date('2026-11-13T12:00:00Z')
const BASE = { refKey: 42, type: 'task' as const, title: 'Ship the feature' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

// ---------------------------------------------------------------------------
// Due date indicator
// ---------------------------------------------------------------------------
describe('TaskCard — due date indicator', () => {
  it('renders no date badge when dueDate is absent', () => {
    render(<TaskCard {...BASE} />)
    expect(screen.queryByText(/overdue|today|tomorrow/i)).not.toBeInTheDocument()
  })

  it('shows "Overdue" for a date in the past', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-01" />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('sets data-overdue="true" on the badge for a past date', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-01" />)
    expect(screen.getByText('Overdue')).toHaveAttribute('data-overdue', 'true')
  })

  it('shows "Today" for today\'s date', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-13" />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('does not mark today as overdue', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-13" />)
    expect(screen.getByText('Today')).not.toHaveAttribute('data-overdue')
  })

  it('shows "Tomorrow" for the next day', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-14" />)
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('does not mark tomorrow as overdue', () => {
    render(<TaskCard {...BASE} dueDate="2026-11-14" />)
    expect(screen.getByText('Tomorrow')).not.toHaveAttribute('data-overdue')
  })

  it('shows a locale-formatted date for dates further out', () => {
    render(<TaskCard {...BASE} dueDate="2026-12-25" />)
    expect(screen.getByText('Dec 25')).toBeInTheDocument()
  })

  it('does not mark a future date as overdue', () => {
    render(<TaskCard {...BASE} dueDate="2026-12-25" />)
    expect(screen.getByText('Dec 25')).not.toHaveAttribute('data-overdue')
  })
})

// ---------------------------------------------------------------------------
// Assignee badge
// ---------------------------------------------------------------------------
describe('TaskCard — assignee badge', () => {
  it('shows the assignee initial with the right title', () => {
    render(<TaskCard {...BASE} assigneeColor="#6366f1" assigneeName="Alice" />)
    expect(screen.getByTitle('Alice')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('falls back to "?" when assigneeName is empty', () => {
    render(<TaskCard {...BASE} assigneeColor="#6366f1" assigneeName="" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('shows the Accept button when no assignee and onAccept is provided', () => {
    render(<TaskCard {...BASE} onAccept={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument()
  })

  it('suppresses the Accept button when already assigned', () => {
    render(<TaskCard {...BASE} assigneeColor="#6366f1" assigneeName="Bob" onAccept={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  })

  it('suppresses the Accept button when task is completed', () => {
    render(<TaskCard {...BASE} isCompleted onAccept={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  })

  it('calls onAccept when Accept button is clicked', () => {
    const onAccept = vi.fn()
    render(<TaskCard {...BASE} onAccept={onAccept} />)
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    expect(onAccept).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
describe('TaskCard — labels', () => {
  it('renders each label name', () => {
    render(<TaskCard {...BASE} labels={[
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#6366f1' },
    ]} />)
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('Feature')).toBeInTheDocument()
  })

  it('renders nothing extra when labels array is empty', () => {
    render(<TaskCard {...BASE} labels={[]} />)
    expect(screen.queryByText('Bug')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Blocked / waiting indicators
// ---------------------------------------------------------------------------
describe('TaskCard — blocked / waiting counters', () => {
  it('shows "{n} blocker(s)" chip when blocked count is greater than zero', () => {
    render(<TaskCard {...BASE} blockedCount={3} />)
    expect(screen.getByText('3 blockers')).toBeInTheDocument()
  })

  it('uses singular "blocker" when count is 1', () => {
    render(<TaskCard {...BASE} blockedCount={1} />)
    expect(screen.getByText('1 blocker')).toBeInTheDocument()
  })

  it('shows "waiting on N" chip when waiting count is greater than zero', () => {
    render(<TaskCard {...BASE} waitingCount={2} />)
    expect(screen.getByText('waiting on 2')).toBeInTheDocument()
  })

  it('shows no blocker chip when count is 0', () => {
    render(<TaskCard {...BASE} blockedCount={0} />)
    expect(screen.queryByText(/blocker/i)).not.toBeInTheDocument()
  })

  it('shows no waiting chip when count is 0', () => {
    render(<TaskCard {...BASE} waitingCount={0} />)
    expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ref key
// ---------------------------------------------------------------------------
describe('TaskCard — ref key', () => {
  it('renders the KAN-N ref key', () => {
    render(<TaskCard {...BASE} refKey={99} />)
    expect(screen.getByText('KAN-99')).toBeInTheDocument()
  })
})
