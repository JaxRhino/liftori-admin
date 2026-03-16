import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let resolved = false

    // One-shot resolve — loading goes false exactly once
    function resolve() {
      if (!resolved && mounted) {
        resolved = true
        setLoading(false)
      }
    }

    async function fetchProfile(userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        if (mounted) setProfile(data)
      } catch (err) {
        console.error('[Auth] Profile fetch error:', err)
        if (mounted) setProfile(null)
      } finally {
        resolve()
      }
    }

    // FAST PATH: Pull user from localStorage immediately — no network needed.
    // This lets the profile fetch start right away instead of waiting for getSession().
    let fastPathUserId = null
    try {
      const storageKey = 'sb-qlerfkdyslndjbaltkwo-auth-token'
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        const cachedUser = parsed?.user || parsed?.currentSession?.user
        if (cachedUser && mounted) {
          fastPathUserId = cachedUser.id
          setUser(cachedUser)
          fetchProfile(cachedUser.id) // kicks off profile fetch immediately
        }
      }
    } catch (e) {
      console.warn('[Auth] Could not read cached session:', e)
    }

    // Safety net — if nothing resolves in 3s, force loading off
    const safetyTimeout = setTimeout(resolve, 3000)

    // Background session validation via Supabase (may hang on Web Locks — that's OK)
    // Only fetches profile if we got a DIFFERENT user than the fast path
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser && sessionUser.id !== fastPathUserId) {
        // Different user than fast path found — re-fetch profile
        fetchProfile(sessionUser.id)
      } else if (!sessionUser && !fastPathUserId) {
        // No user anywhere — resolve immediately
        resolve()
      }
      // Same user as fast path → profile fetch already in progress, don't re-fetch
    }).catch((err) => {
      console.error('[Auth] getSession error:', err)
      if (!fastPathUserId) resolve()
    })

    // Auth state changes (sign in / sign out events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        const sessionUser = session?.user ?? null
        setUser(sessionUser)
        if (sessionUser) {
          await fetchProfile(sessionUser.id)
        } else {
          setProfile(null)
          resolve()
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://admin.liftori.ai/login' }
    })
    if (error) throw error
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'customer'
      })
    }
    return { data, error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dev'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut, signUp }}>
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
