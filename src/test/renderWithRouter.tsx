import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

export function renderWithRouter(
  ui: ReactElement,
  { initialPath = '/' }: { initialPath?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {ui}
    </MemoryRouter>
  )
}
