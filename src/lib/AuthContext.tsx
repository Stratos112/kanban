import { createContext, useContext, useEffect, useState } from 'react'
import { ensureGuestSession } from './auth'
import type { Profile } from './database.types'

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
  setProfile: (p: Profile) => void
  hideOthers: boolean
  setHideOthers: (v: boolean) => void
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
  setProfile: () => {},
  hideOthers: true,
  setHideOthers: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
    hideOthers: localStorage.getItem('kanban-hide-others') !== 'false',
    setProfile: () => {},
    setHideOthers: () => {},
  })

  useEffect(() => {
    ensureGuestSession()
      .then(({ userId, profile }) => setState((s) => ({ ...s, userId, profile, loading: false })))
      .catch((err) => {
        console.error('Auth failed:', err)
        setState((s) => ({ ...s, userId: null, profile: null, loading: false }))
      })
  }, [])

  const setProfile = (p: Profile) => setState((s) => ({ ...s, profile: p }))

  const setHideOthers = (v: boolean) => {
    localStorage.setItem('kanban-hide-others', String(v))
    setState((s) => ({ ...s, hideOthers: v }))
  }

  return (
    <AuthContext.Provider value={{ ...state, setProfile, setHideOthers }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
