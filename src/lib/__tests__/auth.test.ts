import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be declared before the module under test is imported so Vitest hoists it
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn(),
      signInAnonymously: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { ensureGuestSession } from '../auth'
import { supabase } from '../supabase'

const mockGetSession = vi.mocked(supabase.auth.getSession)
const mockSignIn     = vi.mocked(supabase.auth.signInAnonymously)
const mockFrom       = vi.mocked(supabase.from)

const MOCK_PROFILE = {
  id:           'user-123',
  display_name: 'guest_BravePenguin',
  avatar_color: '#6366f1',
  created_at:   new Date().toISOString(),
}
const MOCK_SESSION = { user: { id: 'user-123' }, access_token: 'tok' } as never
const MOCK_USER    = { id: 'user-123' }

// Sets up mockFrom to handle .select().eq().single() returning profileData
function mockSelectChain(profileData: object | null) {
  const single = vi.fn().mockResolvedValue({ data: profileData, error: null })
  const eq     = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select } as never)
}

// Sets up mockFrom to handle .insert() succeeding; returns the insert spy
function mockInsert() {
  const insert = vi.fn().mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ insert } as never)
  return insert
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureGuestSession', () => {
  it('returns the existing session without signing in again', async () => {
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } } as never)
    mockSelectChain(MOCK_PROFILE)

    const result = await ensureGuestSession()

    expect(result).toEqual({ userId: 'user-123', profile: MOCK_PROFILE })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('calls signInAnonymously when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: MOCK_SESSION, user: MOCK_USER },
      error: null,
    } as never)
    mockInsert()

    await ensureGuestSession()

    expect(mockSignIn).toHaveBeenCalledOnce()
  })

  it('creates a profile row for the new guest user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: MOCK_SESSION, user: MOCK_USER },
      error: null,
    } as never)
    const insert = mockInsert()

    await ensureGuestSession()

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id:           MOCK_USER.id,
        display_name: expect.stringMatching(/^guest_[A-Z][a-z]+[A-Z][a-z]+$/),
        avatar_color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      })
    )
  })

  it('assigns a hex avatar color from the predefined palette', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: MOCK_SESSION, user: MOCK_USER },
      error: null,
    } as never)
    const insert = mockInsert()

    await ensureGuestSession()

    const [insertArg] = insert.mock.calls[0] as [{ avatar_color: string }]
    const palette = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
      '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#3b82f6', '#06b6d4',
    ]
    expect(palette).toContain(insertArg.avatar_color)
  })

  it('returns the new session after anonymous sign-in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: MOCK_SESSION, user: MOCK_USER },
      error: null,
    } as never)
    mockInsert()

    const result = await ensureGuestSession()

    expect(result).toEqual(expect.objectContaining({
      userId:  'user-123',
      profile: expect.objectContaining({ id: 'user-123' }),
    }))
  })

  it('throws when signInAnonymously returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Auth service unavailable'),
    } as never)

    await expect(ensureGuestSession()).rejects.toThrow('Auth service unavailable')
  })

  it('throws when sign-in succeeds but returns no user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    mockSignIn.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as never)

    await expect(ensureGuestSession()).rejects.toThrow('Anonymous sign-in returned no user')
  })
})
