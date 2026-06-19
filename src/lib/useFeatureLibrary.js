import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Loads the editable, pre-built feature catalog from feature_library (active,
// ordered). Returns { features, byKey, loading, reload }. Mirrors useStages.
export function useFeatureLibrary() {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return supabase
      .from('feature_library')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setFeatures(data || []); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const byKey = features.reduce((a, f) => ((a[f.key] = f), a), {})
  return { features, byKey, loading, reload: load }
}
