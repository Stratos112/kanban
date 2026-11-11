import { supabase } from './supabase'
import type { Profile } from './database.types'

export interface GuestSession {
  userId: string
  profile: Profile
}

export async function ensureGuestSession(): Promise<GuestSession> {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profile) return { userId: session.user.id, profile }

    // Session exists but profile is missing — recreate it
    return createProfile(session.user.id)
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  const user = data.session?.user
  if (!user) throw new Error('Anonymous sign-in returned no user')

  return createProfile(user.id)
}

async function createProfile(userId: string): Promise<GuestSession> {
  const row = {
    id:           userId,
    display_name: randomGuestName(),
    avatar_color: randomColor(),
  }
  await supabase.from('profiles').insert(row)
  const profile: Profile = { ...row, created_at: new Date().toISOString() }
  return { userId, profile }
}

// ── Random identity ───────────────────────────────

const ADJECTIVES = [
  'Crazy', 'Wild', 'Speedy', 'Silent', 'Brave', 'Fuzzy', 'Sneaky', 'Clumsy',
  'Jolly', 'Grumpy', 'Mighty', 'Swift', 'Clever', 'Dizzy', 'Zesty', 'Goofy',
  'Sassy', 'Bouncy', 'Fierce', 'Mellow', 'Cosmic', 'Neon', 'Rusty', 'Funky',
  'Crispy', 'Spooky', 'Fluffy', 'Tangy', 'Wobbly', 'Zippy', 'Plucky', 'Daring',
]

const ANIMALS = [
  'Antelope', 'Penguin', 'Raccoon', 'Capybara', 'Narwhal', 'Axolotl',
  'Platypus', 'Ocelot', 'Pangolin', 'Wombat', 'Quokka', 'Meerkat',
  'Fennec', 'Tapir', 'Kinkajou', 'Numbat', 'Aardvark', 'Manatee',
  'Porcupine', 'Salamander', 'Armadillo', 'Cockatoo', 'Binturong', 'Dingo',
]

function randomGuestName() {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `guest_${adj}${animal}`
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}
