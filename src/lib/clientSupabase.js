// =====================================================================
// Per-Client Supabase Client Factory (LABOS)
// ---------------------------------------------------------------------
// Every LABOS client has their own isolated Supabase project.
// This factory fetches the routing info from the main Liftori DB
// (platforms table), then constructs + caches a per-client Supabase
// client keyed by platform.id.
//
// Usage:
//   const { client, platform } = await getClientSupabase(platformId)
//   const { data } = await client.from('products').select('*')
// =====================================================================

import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const clientCache = new Map()
const platformCache = new Map()

/**
 * Load platform routing info from main Liftori DB.
 * Returns the full platforms row including supabase_url/key/project_id.
 */
export async function loadPlatform(platformId) {
  if (platformCache.has(platformId)) return platformCache.get(platformId)
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('id', platformId)
    .single()
  if (error) throw error
  platformCache.set(platformId, data)
  return data
}

/**
 * Get (or build) a Supabase client scoped to a specific LABOS platform.
 * Uses publishable/anon key so RLS on the client DB is still enforced.
 */
export async function getClientSupabase(platformId) {
  if (!platformId) throw new Error('platformId required')
  if (clientCache.has(platformId)) {
    return { client: clientCache.get(platformId), platform: platformCache.get(platformId) }
  }
  const platform = await loadPlatform(platformId)
  if (!platform.supabase_url || !platform.supabase_publishable_key) {
    throw new Error(`Platform ${platform.client_name || platformId} is not LABOS-provisioned yet.`)
  }
  const client = createClient(platform.supabase_url, platform.supabase_publishable_key, {
    auth: {
      // Don't persist client-DB session in the same storage slot as the
      // main admin session — use a per-platform storage key.
      storageKey: `labos-${platformId}`,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-liftori-platform-id': platformId },
    },
  })
  clientCache.set(platformId, client)
  return { client, platform }
}

/** Invalidate a cached client — call after updating platform routing. */
export function invalidateClientSupabase(platformId) {
  clientCache.delete(platformId)
  platformCache.delete(platformId)
}
