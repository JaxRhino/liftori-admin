import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // FAST PATH: Read cached session from localStorage immediately.
    // This bypasses getSession() which can deadlock via Web Locks API.
    try {
      const storageKey = 'sb-qlerfkdyslndjbaltkwo-auth-token'
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        const cachedUser = parsed?.user || parsed?.currentSession?.user
        if (cachedUser && mounted) {
          setUser(cachedUser)
          fetchProfile(cachedUser.id)
        }
      }
    } catch (e) {
      console.warn('Could not read cached session:', e)
    }

    // Safety timeout — if auth hasn't resolved in 2 seconds, force loading off.
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth safety timeout \u2014 forcing load complete')
        setLoading(false)
      }
    }, 2000)

    // Validate session in background (may hang due to Web Locks \u2014 that is OK now)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }).catch((err) => {
      console.error('Session error:', err)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dev'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
