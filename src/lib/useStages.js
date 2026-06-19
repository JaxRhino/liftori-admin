import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { DEFAULT_STAGES } from './products'

// Loads the editable build stages from product_stages (ordered), falling back
// to DEFAULT_STAGES. Returns { stages, byKey, loading, reload }.
export function useStages() {
  const [stages, setStages] = useState(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return supabase
      .from('product_stages')
      .select('stage_key,label,sort_order,color')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setStages(data && data.length ? data : DEFAULT_STAGES)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  const byKey = stages.reduce((a, s) => ((a[s.stage_key] = s), a), {})
  return { stages, byKey, loading, reload: load }
}
