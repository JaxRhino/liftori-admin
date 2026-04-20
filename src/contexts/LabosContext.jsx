// =====================================================================
// LabosContext — scopes a React subtree to a single LABOS client DB.
// Provides: client-scoped supabase, platform row, org_settings,
// enabled hubs, loading/error state.
// =====================================================================

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getClientSupabase } from '../lib/clientSupabase'

const LabosContext = createContext(null)

export function LabosProvider({ children }) {
  const { platformId } = useParams()
  const [client, setClient] = useState(null)
  const [platform, setPlatform] = useState(null)
  const [orgSettings, setOrgSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const { client, platform } = await getClientSupabase(platformId)
        if (!active) return
        setClient(client)
        setPlatform(platform)
        const { data: settings } = await client.from('org_settings').select('*').eq('id', 1).maybeSingle()
        if (!active) return
        setOrgSettings(settings)
      } catch (e) {
        if (active) setError(e)
      } finally {
        if (active) setLoading(false)
      }
    }
    if (platformId) load()
    return () => { active = false }
  }, [platformId])

  const enabledHubs = useMemo(() => {
    const hubs = platform?.labos_hubs
    if (Array.isArray(hubs)) return hubs
    return ['dashboard','sales','operations','marketing','finance','communications','chat','support']
  }, [platform])

  const value = useMemo(() => ({
    platformId, client, platform, orgSettings, enabledHubs, loading, error,
  }), [platformId, client, platform, orgSettings, enabledHubs, loading, error])

  return <LabosContext.Provider value={value}>{children}</LabosContext.Provider>
}

export function useLabos() {
  const ctx = useContext(LabosContext)
  if (!ctx) throw new Error('useLabos must be used inside <LabosProvider>')
  return ctx
}
