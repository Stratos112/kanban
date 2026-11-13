import { createContext, useContext, useEffect, useState } from 'react'
import { ensureGuestSession } from './auth'
import { supabase } from './supabase'
import type { Profile } from './database.types'

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
  isGuest: boolean
  setProfile: (p: Profile) => void
  hideOthers: boolean
  setHideOthers: (v: boolean) => void
  teammateIds: Set<string>
  refreshTeammates: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
  isGuest: true,
  setProfile: () => {},
  hideOthers: true,
  setHideOthers: () => {},
  teammateIds: new Set(),
  refreshTeammates: async () => {},
  signOut: async () => {},
})

async function fetchTeammateIds(uid: string): Promise<Set<string>> {
  const { data } = await (supabase as any)
    .from('team_invites')
    .select('inviter_id, invitee_id')
    .or(`inviter_id.eq.${uid},invitee_id.eq.${uid}`)
    .eq('status', 'accepted')
  const ids = new Set<string>()
  for (const row of (data ?? []) as { inviter_id: string; invitee_id: string }[]) {
    if (row.inviter_id !== uid) ids.add(row.inviter_id)
    if (row.invitee_id !== uid) ids.add(row.invitee_id)
  }
  return ids
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
    isGuest: true,
    setProfile: () => {},
    hideOthers: localStorage.getItem('kanban-hide-others') !== 'false',
    setHideOthers: () => {},
    teammateIds: new Set(),
    refreshTeammates: async () => {},
    signOut: async () => {},
  })

  useEffect(() => {
    ensureGuestSession()
      .then(async ({ userId, profile }) => {
        const { data: { session } } = await supabase.auth.getSession()
        const isGuest = session?.user.is_anonymous ?? true
        const teammateIds = await fetchTeammateIds(userId)
        setState((s) => ({ ...s, userId, profile, loading: false, isGuest, teammateIds }))
      })
      .catch((err) => {
        console.error('Auth failed:', err)
        setState((s) => ({ ...s, loading: false }))
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'USER_UPDATED' || event === 'SIGNED_IN') && session) {
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()
        setState((s) => ({
          ...s,
          userId: session.user.id,
          profile: profile ?? s.profile,
          isGuest: session.user.is_anonymous ?? false,
          loading: false,
        }))
      }
      if (event === 'SIGNED_OUT') {
        ensureGuestSession().then(async ({ userId, profile }) => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          setState((s) => ({ ...s, userId, profile, isGuest: s2?.user.is_anonymous ?? true, loading: false }))
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const setProfile = (p: Profile) => setState((s) => ({ ...s, profile: p }))

  const setHideOthers = (v: boolean) => {
    localStorage.setItem('kanban-hide-others', String(v))
    setState((s) => ({ ...s, hideOthers: v }))
  }

  const refreshTeammates = async () => {
    if (!state.userId) return
    const ids = await fetchTeammateIds(state.userId)
    setState((s) => ({ ...s, teammateIds: ids }))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ ...state, setProfile, setHideOthers, refreshTeammates, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
