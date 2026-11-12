import { createContext, useContext, useEffect, useState } from 'react'
import { ensureGuestSession } from './auth'
import type { Profile } from './database.types'

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
  setProfile: (p: Profile) => void
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
  setProfile: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
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

  return <AuthContext.Provider value={{ ...state, setProfile }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
