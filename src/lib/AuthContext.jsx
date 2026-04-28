import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { isFounder } from './testerProgramService'

const AuthContext = createContext(null)

const IMPERSONATE_STORAGE_KEY = 'liftori.impersonatedUserId'

export function AuthProvider({ children }) {
  // Real auth state — the actual logged-in user
  const [realUser, setRealUser] = useState(null)
  const [realProfile, setRealProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)
  const [isDevTeamMember, setIsDevTeamMember] = useState(false)

  // View-as-user (impersonation) state. When set, the UI renders as if the
  // impersonated user were logged in, but the underlying Supabase session
  // and JWT are still the real founder's — writes are still attributed to
  // the real user, and RLS still sees the founder's auth.uid().
  const [impersonatedUserId, setImpersonatedUserId] = useState(() => {
    if (typeof window === 'undefined') return null
    try { return window.localStorage.getItem(IMPERSONATE_STORAGE_KEY) || null }
    catch { return null }
  })
  const [impersonatedProfile, setImpersonatedProfile] = useState(null)

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
        if (mounted) setRealProfile(data)
      } catch (err) {
        console.error('[Auth] Profile fetch error:', err)
        if (mounted) setRealProfile(null)
      } finally {
        if (endLoading && mounted) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        const sessionUser = session?.user ?? null
        setRealUser(sessionUser)
        setToken(session?.access_token ?? null)
        const isInitial = event === 'INITIAL_SESSION'
        const isSignIn = event === 'SIGNED_IN'
        if (sessionUser) {
          if (isSignIn && !isInitial) setLoading(true)
          fetchProfile(sessionUser.id, isInitial || isSignIn)
        } else {
          setRealProfile(null)
          if (isInitial) setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ─── Dev Team membership (Wave A: gates the /admin/dev-team tab) ──
  useEffect(() => {
    let cancelled = false
    async function checkDevTeam() {
      if (!realUser?.id) { setIsDevTeamMember(false); return }
      try {
        const { data, error } = await supabase.rpc('is_dev_team_member', { check_user_id: realUser.id })
        if (error) throw error
        if (!cancelled) setIsDevTeamMember(!!data)
      } catch (err) {
        if (!cancelled) {
          console.warn('[Auth] dev team check failed:', err?.message || err)
          setIsDevTeamMember(false)
        }
      }
    }
    checkDevTeam()
    return () => { cancelled = true }
  }, [realUser?.id])

  // Founder gating — derived from the REAL profile/user, not the impersonated
  // one. Losing impersonation access just because you're viewing-as a tester
  // would be a nasty footgun.
  const canImpersonate = useMemo(
    () => isFounder(realProfile) || isFounder(realUser),
    [realProfile, realUser]
  )

  // Load the impersonated user's profile whenever the impersonated ID changes.
  useEffect(() => {
    let cancelled = false
    async function loadImpersonated() {
      if (!impersonatedUserId) { setImpersonatedProfile(null); return }
      if (realUser && !canImpersonate) {
        setImpersonatedUserId(null)
        try { window.localStorage.removeItem(IMPERSONATE_STORAGE_KEY) } catch {}
        return
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', impersonatedUserId)
          .single()
        if (error) throw error
        if (!cancelled) setImpersonatedProfile(data)
      } catch (err) {
        console.error('[Auth] Impersonated profile fetch error:', err)
        if (!cancelled) {
          setImpersonatedProfile(null)
          setImpersonatedUserId(null)
          try { window.localStorage.removeItem(IMPERSONATE_STORAGE_KEY) } catch {}
        }
      }
    }
    loadImpersonated()
    return () => { cancelled = true }
  }, [impersonatedUserId, realUser, canImpersonate])

  function stopImpersonationInternal() {
    try { window.localStorage.removeItem(IMPERSONATE_STORAGE_KEY) } catch {}
    setImpersonatedUserId(null)
    setImpersonatedProfile(null)
  }

  const startImpersonation = useCallback((userId) => {
    if (!canImpersonate) return
    if (!userId) return
    if (realUser && userId === realUser.id) { stopImpersonationInternal(); return }
    try { window.localStorage.setItem(IMPERSONATE_STORAGE_KEY, userId) } catch {}
    setImpersonatedUserId(userId)
  }, [canImpersonate, realUser])

  const stopImpersonation = useCallback(stopImpersonationInternal, [])

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
    setRealUser(null)
    setRealProfile(null)
    setToken(null)
    stopImpersonationInternal()
  }

  async function refreshProfile() {
    if (!realUser?.id) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', realUser.id)
        .single()
      if (error) throw error
      setRealProfile(data)
    } catch (err) {
      console.error('[Auth] Profile refresh error:', err)
    }
  }

  // ─── Effective identity ──────────────────────────────────────────
  const isImpersonating = !!(impersonatedUserId && impersonatedProfile && realUser && impersonatedUserId !== realUser.id)

  const effectiveUser = isImpersonating
    ? { ...realUser, id: impersonatedProfile.id, email: impersonatedProfile.email, __impersonated: true }
    : realUser
  const effectiveProfile = isImpersonating ? impersonatedProfile : realProfile

  const isAdmin = ['admin', 'dev', 'super_admin', 'sales_director', 'call_agent', 'tester'].includes(effectiveProfile?.role)
  const isAffiliate = effectiveProfile?.role === 'affiliate'

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      profile: effectiveProfile,
      realUser,
      realProfile,
      loading,
      isAdmin,
      isAffiliate,
      isDevTeamMember,
      token,
      isImpersonating,
      canImpersonate,
      impersonatedUserId,
      startImpersonation,
      stopImpersonation,
      signIn,
      signOut,
      signUp,
      refreshProfile,
    }}>
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
