import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    let mounted = true

    async function fetchProfile(userId, endLoading = false) {
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
        if (endLoading && mounted) setLoading(false)
      }
    }

    // onAuthStateChange fires INITIAL_SESSION on every page load/refresh.
    // This is Supabase's recommended SPA pattern and avoids the Web Locks
    // hang that broke page refresh (getSession() can deadlock on reload).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        const sessionUser = session?.user ?? null
        setUser(sessionUser)
        setToken(session?.access_token ?? null)
        const isInitial = event === 'INITIAL_SESSION'
        const isSignIn = event === 'SIGNED_IN'
        if (sessionUser) {
          // On sign-in, set loading true so route guards wait for profile
          if (isSignIn && !isInitial) setLoading(true)
          // endLoading on both initial session and sign-in
          fetchProfile(sessionUser.id, isInitial || isSignIn)
        } else {
          setProfile(null)
          if (isInitial) setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
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
    setToken(null)
  }

  async function refreshProfile() {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('[Auth] Profile refresh error:', err)
    }
  }

  // 'tester' included so enrolled testers can reach /admin (TesterDashboard renders there).
  // Super Admin page is gated separately by founder email allowlist.
  const isAdmin = ['admin', 'dev', 'super_admin', 'sales_director', 'call_agent', 'tester'].includes(profile?.role)
  // Affiliates get their own /affiliate portal tree (like /portal for customers).
  const isAffiliate = profile?.role === 'affiliate'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isAffiliate, token, signIn, signOut, signUp, refreshProfile }}>
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
