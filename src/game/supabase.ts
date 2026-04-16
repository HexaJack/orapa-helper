import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function getPlayerId(): string {
  let id = localStorage.getItem('orapa-player-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('orapa-player-id', id)
  }
  return id
}
