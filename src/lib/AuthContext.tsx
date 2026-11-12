import { createContext, useContext, useEffect, useState } from 'react'
import { ensureGuestSession } from './auth'
import type { Profile } from './database.types'

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    ensureGuestSession()
      .then(({ userId, profile }) => setState({ userId, profile, loading: false }))
      .catch((err) => {
        console.error('Auth failed:', err)
        setState({ userId: null, profile: null, loading: false })
      })
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
