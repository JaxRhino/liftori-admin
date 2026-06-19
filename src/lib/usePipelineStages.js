import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Loads editable pipeline stages for a given surface ('custom_build' | 'project')
// from pipeline_stages, ordered. Returns { stages, byKey, loading, reload }.
export function usePipelineStages(surface) {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return supabase
      .from('pipeline_stages')
      .select('stage_key,label,sort_order,color')
      .eq('surface', surface)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setStages(data || []); setLoading(false) })
  }, [surface])

  useEffect(() => { load() }, [load])

  const byKey = stages.reduce((a, s) => ((a[s.stage_key] = s), a), {})
  return { stages, byKey, loading, reload: load }
}
