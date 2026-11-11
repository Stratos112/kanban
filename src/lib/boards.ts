import { supabase } from './supabase'
import type { Board } from './database.types'

export async function listBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getBoardBySlug(slug: string): Promise<Board | null> {
  const { data } = await supabase
    .from('boards')
    .select('*')
    .eq('invite_code', slug)
    .single()
  return data ?? null
}

export async function createBoard(name: string): Promise<Board> {
  const invite_code = slugify(name || 'New Board')
  const { data, error } = await supabase
    .from('boards')
    .insert({ name: name.trim() || 'New Board', invite_code })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameBoard(id: string, name: string): Promise<void> {
  await supabase.from('boards').update({ name }).eq('id', id)
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'board'
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}
