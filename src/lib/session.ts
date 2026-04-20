import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { SessionUser } from '../types'

const STORAGE_KEY = 'catertrax_session_user'

function loadFromStorage(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

function saveToStorage(user: SessionUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Create a new session user in Supabase and persist to localStorage.
 */
export async function createSessionUser(displayName: string): Promise<SessionUser> {
  const { data, error } = await supabase
    .from('session_users')
    .insert({ display_name: displayName })
    .select('id, display_name')
    .single()

  if (error) throw new Error(error.message)

  const user: SessionUser = { id: data.id as string, display_name: data.display_name as string }
  saveToStorage(user)
  return user
}

/**
 * Hook: returns current session user and setter.
 * On mount, loads from localStorage. When setUser is called,
 * creates the user in Supabase and persists locally.
 */
export function useSession() {
  const [user, setUserState] = useState<SessionUser | null>(() => loadFromStorage())

  useEffect(() => {
    if (user) {
      // Bump last_seen_at in the background — ignore errors
      supabase
        .from('session_users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
    }
  }, [user?.id])

  async function setUser(displayName: string): Promise<void> {
    const newUser = await createSessionUser(displayName)
    setUserState(newUser)
  }

  function switchUser(): void {
    clearSession()
    setUserState(null)
  }

  return { user, setUser, switchUser }
}
