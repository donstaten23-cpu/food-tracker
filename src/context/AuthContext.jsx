import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [household, setHousehold] = useState(undefined) // undefined = loading, null = none yet

  const loadHousehold = useCallback(async (userId) => {
    if (!userId) {
      setHousehold(null)
      return
    }
    const { data } = await supabase
      .from('household_members')
      .select('household_id, role, households ( id, name, invite_code )')
      .eq('user_id', userId)
      .maybeSingle()
    setHousehold(data ? { id: data.household_id, role: data.role, ...data.households } : null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadHousehold(data.session?.user?.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadHousehold(newSession?.user?.id)
    })

    return () => sub.subscription.unsubscribe()
  }, [loadHousehold])

  const value = {
    session,
    user: session?.user ?? null,
    household,
    refreshHousehold: () => loadHousehold(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
