import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase/client'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readableAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no son correctos.'
  if (/email not confirmed/i.test(message)) return 'Confirma el correo de tu invitación antes de acceder.'
  if (/fetch/i.test(message)) return 'No se pudo contactar con Supabase. Revisa la conexión e inténtalo de nuevo.'
  return 'No se pudo iniciar sesión. Comprueba los datos e inténtalo de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, loading: true, profileError: null })

  const syncProfile = useCallback(async (session: Session | null) => {
    if (!supabase || !session) {
      setState({ session, profile: null, loading: false, profileError: null })
      return
    }
    setState((previous) => ({ ...previous, session, loading: true, profileError: null }))
    const { data, error } = await supabase
      .from('profiles')
      .select('id, team_id, full_name, role')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error) {
      setState({ session, profile: null, loading: false, profileError: 'No se pudo cargar tu perfil. Comprueba que la migración de Cullera FC esté aplicada en Supabase.' })
      return
    }
    if (!data) {
      setState({ session, profile: null, loading: false, profileError: 'Tu cuenta aún no está vinculada al equipo. Pide al entrenador que complete tu perfil de acceso.' })
      return
    }
    setState({ session, profile: data as Profile, loading: false, profileError: null })
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setState({ session: null, profile: null, loading: false, profileError: null })
      return
    }
    let active = true
    const hydrate = async (session: Session | null) => {
      if (!active) return
      await syncProfile(session)
    }
    void supabase.auth.getSession().then(({ data }) => hydrate(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void hydrate(session) })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [syncProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'La conexión de Supabase no está configurada.' }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error ? readableAuthError(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    await syncProfile(state.session)
  }, [state.session, syncProfile])

  const value = useMemo(() => ({ ...state, signIn, signOut, refreshProfile }), [state, signIn, signOut, refreshProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  return value
}
