import { supabase } from './supabase'

// Called once on app boot. Returns the existing session or creates a new
// anonymous guest session and an associated profile row.
export async function ensureGuestSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error

  const user = data.session?.user
  if (!user) throw new Error('Anonymous sign-in returned no user')

  // Create a profile row for this new guest
  await supabase.from('profiles').insert({
    id: user.id,
    display_name: 'Guest',
    avatar_color: randomColor(),
  })

  return data.session!
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}
