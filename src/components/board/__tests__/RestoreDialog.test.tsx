import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RestoreDialog from '../RestoreDialog'
import type { CascadedTask } from '../../../lib/completion'
import type { BlockedRestorable } from '../RestoreDialog'

vi.mock('../RestoreDialog.module.css', () => ({
  default: new Proxy({}, { get: (_t, prop) => String(prop) }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CASCADE_TASKS: CascadedTask[] = [
  { id: 'B', refKey: 2, title: 'Task B', previousStatus: 'in_progress' },
  { id: 'C', refKey: 3, title: 'Task C', previousStatus: 'ready' },
]

const BLOCKED_TASKS: BlockedRestorable[] = [
  { id: 'D', refKey: 4, title: 'Task D' },
  { id: 'E', refKey: 5, title: 'Task E' },
]

function renderDialog(overrides: Partial<React.ComponentProps<typeof RestoreDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()

  const props = {
    taskTitle: 'Task A',
    cascadedTasks: CASCADE_TASKS,
    blockedTasks: BLOCKED_TASKS,
    onConfirm,
    onCancel,
    ...overrides,
  }

  render(<RestoreDialog {...props} />)
  return { onConfirm, onCancel }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RestoreDialog', () => {
  it('renders cascade task titles and their KAN-N ref keys', () => {
    renderDialog()

    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.getByText('KAN-2')).toBeInTheDocument()
    expect(screen.getByText('Task C')).toBeInTheDocument()
    expect(screen.getByText('KAN-3')).toBeInTheDocument()
  })

  it('cascade task checkboxes are checked by default', () => {
    renderDialog()

    const checkboxes = screen.getAllByRole('checkbox')
    // First two correspond to cascade tasks
    const cascadeCheckboxes = checkboxes.slice(0, 2)
    cascadeCheckboxes.forEach((cb) => {
      expect(cb).toBeChecked()
    })
  })

  it('renders blocked task titles', () => {
    renderDialog()

    expect(screen.getByText('Task D')).toBeInTheDocument()
    expect(screen.getByText('Task E')).toBeInTheDocument()
  })

  it('blocked task checkboxes are unchecked by default', () => {
    renderDialog()

    const checkboxes = screen.getAllByRole('checkbox')
    // Last two correspond to blocked tasks
    const blockedCheckboxes = checkboxes.slice(2)
    blockedCheckboxes.forEach((cb) => {
      expect(cb).not.toBeChecked()
    })
  })

  it('button shows "Restore 2 tasks" when 2 cascade tasks are checked by default', () => {
    renderDialog({ blockedTasks: [] })

    expect(screen.getByRole('button', { name: /restore 2 tasks/i })).toBeInTheDocument()
  })

  it('unchecking one cascade task decrements the button label to "Restore 1 task"', async () => {
    renderDialog({ blockedTasks: [] })

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])

    expect(screen.getByRole('button', { name: /restore 1 task\b/i })).toBeInTheDocument()
  })

  it('checking a blocked task increments the button label', async () => {
    // Start with 2 cascade tasks checked (default) + 0 blocked
    renderDialog()

    const checkboxes = screen.getAllByRole('checkbox')
    // Click the first blocked task checkbox (index 2)
    await userEvent.click(checkboxes[2])

    expect(screen.getByRole('button', { name: /restore 3 tasks/i })).toBeInTheDocument()
  })

  it('clicking "Skip restore" calls onCancel', () => {
    const { onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /skip restore/i }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('clicking the Restore button calls onConfirm with correct selectedCascadeIds and selectedBlockedIds', async () => {
    const { onConfirm } = renderDialog()

    // Uncheck cascade task C (index 1) and check blocked task D (index 2)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[1]) // uncheck C
    await userEvent.click(checkboxes[2]) // check D

    fireEvent.click(screen.getByRole('button', { name: /^Restore/ }))

    expect(onConfirm).toHaveBeenCalledOnce()
    const [selectedCascadeIds, selectedBlockedIds] = onConfirm.mock.calls[0] as [string[], string[]]
    expect(selectedCascadeIds).toContain('B')
    expect(selectedCascadeIds).not.toContain('C')
    expect(selectedBlockedIds).toContain('D')
    expect(selectedBlockedIds).not.toContain('E')
  })

  it('when cascadedTasks is empty, the cascade section is not shown', () => {
    renderDialog({ cascadedTasks: [] })

    expect(screen.queryByText('Task B')).not.toBeInTheDocument()
    expect(screen.queryByText('Task C')).not.toBeInTheDocument()
  })

  it('when blockedTasks is empty, the blocked section is not shown', () => {
    renderDialog({ blockedTasks: [] })

    expect(screen.queryByText('Task D')).not.toBeInTheDocument()
    expect(screen.queryByText('Task E')).not.toBeInTheDocument()
  })

  it('when blockedTasks is omitted, the blocked section is not shown', () => {
    const { onConfirm, onCancel } = renderDialog({ blockedTasks: undefined })
    void onConfirm
    void onCancel

    expect(screen.queryByText('Task D')).not.toBeInTheDocument()
  })
})
