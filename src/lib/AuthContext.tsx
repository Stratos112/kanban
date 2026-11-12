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
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
    isGuest: true,
    setProfile: () => {},
    hideOthers: localStorage.getItem('kanban-hide-others') !== 'false',
    setHideOthers: () => {},
    signOut: async () => {},
  })

  useEffect(() => {
    ensureGuestSession()
      .then(async ({ userId, profile }) => {
        const { data: { session } } = await supabase.auth.getSession()
        const isGuest = session?.user.is_anonymous ?? true
        setState((s) => ({ ...s, userId, profile, loading: false, isGuest }))
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

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ ...state, setProfile, setHideOthers, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
