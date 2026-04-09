import { useAuth } from './AuthContext';

/**
 * Returns the current tenant_id for Lead Hunter queries.
 * - Liftori admins (role=admin): null (sees master/Liftori data)
 * - Client users: their profile.id (tenant isolation)
 *
 * Every Lead Hunter query should filter by this value:
 *   .is('tenant_id', null)    // for admin
 *   .eq('tenant_id', id)      // for clients
 *
 * Usage:
 *   const { tenantId, isAdmin, tenantFilter } = useTenantId();
 *   // Then in queries:
 *   let query = supabase.from('lh_companies').select('*');
 *   query = tenantFilter(query);
 */
export function useTenantId() {
  const { profile, isAdmin } = useAuth();

  const tenantId = isAdmin ? null : profile?.id || null;

  // Helper: applies the correct tenant filter to a Supabase query builder
  const tenantFilter = (query) => {
    if (isAdmin) {
      // Admin sees all data where tenant_id is null (Liftori master)
      // In the future, admin could have a tenant switcher to view client data
      return query.is('tenant_id', null);
    }
    return query.eq('tenant_id', tenantId);
  };

  return { tenantId, isAdmin, tenantFilter };
}
