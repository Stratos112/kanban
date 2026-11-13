import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithRouter } from '../../test/renderWithRouter'
import ProfilePage from '../ProfilePage'

// ---------------------------------------------------------------------------
// Supabase — permissive stub returning empty data for all queries
// ---------------------------------------------------------------------------
function makeQuery(data: unknown = []) {
  const q: Record<string, unknown> = {}
  const chain = () => q
  for (const m of ['select', 'eq', 'neq', 'or', 'in', 'insert', 'update', 'delete', 'order', 'single', 'maybeSingle', 'filter', 'limit']) {
    q[m] = vi.fn().mockReturnValue(q)
  }
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res)
  q.catch = (rej: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).catch(rej)
  void chain
  return q
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => makeQuery()),
    auth:  { linkIdentity: vi.fn(), getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

// ---------------------------------------------------------------------------
// AuthContext — full mock matching the current interface
// ---------------------------------------------------------------------------
const baseAuth = {
  profile:           { id: 'u1', display_name: 'Alice', avatar_color: '#6366f1', created_at: '' },
  userId:            'u1',
  loading:           false,
  isGuest:           true,
  setProfile:        vi.fn(),
  hideOthers:        false,
  setHideOthers:     vi.fn(),
  teammateIds:       new Set<string>(),
  refreshTeammates:  vi.fn().mockResolvedValue(undefined),
  signOut:           vi.fn(),
}

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => baseAuth,
}))

// ---------------------------------------------------------------------------
// Identity tab (default)
// ---------------------------------------------------------------------------
describe('ProfilePage — identity tab', () => {
  it('renders the page heading', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument()
  })

  it('renders the display name input pre-filled from the profile', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('textbox', { name: /display name/i })).toHaveValue('Alice')
  })

  it('renders Identity and Team tab buttons', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('button', { name: /^identity$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^team/i })).toBeInTheDocument()
  })

  it('shows the focus mode toggle', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText(/focus mode/i)).toBeInTheDocument()
  })

  it('renders the stats section', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders the Google sign-in button for a guest user', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows the avatar swatch', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByRole('button', { name: /pick avatar color/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Team tab
// ---------------------------------------------------------------------------
describe('ProfilePage — team tab', () => {
  it('switches to the team view when the Team tab is clicked', async () => {
    renderWithRouter(<ProfilePage />)
    fireEvent.click(screen.getByRole('button', { name: /^team/i }))
    await waitFor(() => {
      expect(screen.getByText(/invite board members/i)).toBeInTheDocument()
    })
  })

  it('shows empty invite list message when no other users exist', async () => {
    renderWithRouter(<ProfilePage />)
    fireEvent.click(screen.getByRole('button', { name: /^team/i }))
    await waitFor(() => {
      expect(screen.getByText(/no other users on your boards yet/i)).toBeInTheDocument()
    })
  })

  it('switches back to identity view when Identity tab is clicked', async () => {
    renderWithRouter(<ProfilePage />)
    fireEvent.click(screen.getByRole('button', { name: /^team/i }))
    await waitFor(() => screen.getByText(/invite board members/i))

    fireEvent.click(screen.getByRole('button', { name: /^identity$/i }))
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Invite popup
// ---------------------------------------------------------------------------
describe('ProfilePage — pending invite popup', () => {
  it('shows the invite popup when there are pending invites', async () => {
    const { supabase } = await import('../../lib/supabase')
    const mockFrom = vi.mocked(supabase.from)

    // First call (checkInvites): return one pending invite row
    const inviteRow = { id: 'inv1', inviter_id: 'u2', inviter_color: '#22c55e' }
    const profileRow = { id: 'u2', display_name: 'Bob' }

    // Chain for team_invites query: .select().eq().eq() → data
    const inviteSingle = vi.fn().mockResolvedValue({ data: null })
    const inviteEq2    = vi.fn().mockReturnValue(Promise.resolve({ data: [inviteRow], error: null }))
    const inviteEq1    = vi.fn().mockReturnValue({ eq: inviteEq2, single: inviteSingle })
    const inviteSelect = vi.fn().mockReturnValue({ eq: inviteEq1 })

    // Chain for profiles query: .select().in() → data
    const profileIn     = vi.fn().mockResolvedValue({ data: [profileRow], error: null })
    const profileSelect = vi.fn().mockReturnValue({ in: profileIn })

    mockFrom
      .mockReturnValueOnce({ select: inviteSelect } as never)   // team_invites
      .mockReturnValueOnce({ select: profileSelect } as never)  // profiles

    renderWithRouter(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText(/team invitation/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Focus mode
// ---------------------------------------------------------------------------
describe('ProfilePage — focus mode', () => {
  it('renders the focus mode card', () => {
    renderWithRouter(<ProfilePage />)
    expect(screen.getByText(/focus mode/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('reflects the initial hideOthers value on the toggle', () => {
    renderWithRouter(<ProfilePage />)
    // baseAuth.hideOthers = false
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })
})
