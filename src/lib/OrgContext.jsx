/**
 * OrgContext — Multi-tenant organization context for LABOS
 *
 * Provides:
 * - currentOrg: the org the user is currently viewing
 * - allOrgs: all orgs (admin only, for the org switcher)
 * - features: Set of enabled feature keys for current org
 * - hasFeature(key): check if a feature is enabled
 * - isAdmin: true if user is a Liftori super admin
 * - isImpersonating: true if admin is viewing a customer's org
 * - switchOrg(orgId): switch to viewing a different org (admin only)
 * - resetOrg(): switch back to Liftori admin view
 * - orgMembers: members of the current org
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user, profile } = useAuth();

  const [homeOrg, setHomeOrg] = useState(null);        // user's own org
  const [currentOrg, setCurrentOrg] = useState(null);   // org being viewed (may differ for admin impersonation)
  const [allOrgs, setAllOrgs] = useState([]);            // all orgs (admin only)
  const [features, setFeatures] = useState(new Set());   // enabled feature keys for current org
  const [orgMembers, setOrgMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.is_super_admin === true || profile?.role === 'super_admin' || profile?.role === 'admin';
  const isImpersonating = isAdmin && currentOrg && homeOrg && currentOrg.id !== homeOrg.id;

  // ─── Load org data on auth ─────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    loadOrgData();
  }, [user?.id, profile?.id]);

  async function loadOrgData() {
    setLoading(true);
    try {
      // Get user's org membership
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id, role, organizations(*)')
        .eq('user_id', profile.id)
        .limit(1)
        .maybeSingle();

      let userOrg = membership?.organizations || null;

      // If no membership but has org_id on profile, try direct lookup
      if (!userOrg && profile.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .maybeSingle();
        userOrg = orgData;
      }

      setHomeOrg(userOrg);
      setCurrentOrg(userOrg);

      // Load features for this org
      if (userOrg) {
        await loadFeatures(userOrg.id);
        await loadMembers(userOrg.id);
      }

      // If admin, load all orgs for the switcher
      if (isAdmin) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('*')
          .order('name');
        setAllOrgs(orgs || []);
      }
    } catch (err) {
      console.error('OrgContext load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFeatures(orgId) {
    const { data } = await supabase
      .from('tenant_features')
      .select('feature_key, enabled')
      .eq('org_id', orgId);

    const enabledKeys = new Set(
      (data || []).filter(f => f.enabled).map(f => f.feature_key)
    );
    setFeatures(enabledKeys);
  }

  async function loadMembers(orgId) {
    const { data } = await supabase
      .from('org_members')
      .select('*, profiles:user_id(id, full_name, email, avatar_url)')
      .eq('org_id', orgId)
      .order('role');
    setOrgMembers(data || []);
  }

  // ─── Admin: switch to viewing a customer org ───────────────────
  const switchOrg = useCallback(async (orgId) => {
    if (!isAdmin) return;

    const targetOrg = allOrgs.find(o => o.id === orgId);
    if (!targetOrg) return;

    setCurrentOrg(targetOrg);
    await loadFeatures(orgId);
    await loadMembers(orgId);
  }, [isAdmin, allOrgs]);

  // ─── Admin: switch back to home org ────────────────────────────
  const resetOrg = useCallback(async () => {
    if (!homeOrg) return;
    setCurrentOrg(homeOrg);
    await loadFeatures(homeOrg.id);
    await loadMembers(homeOrg.id);
  }, [homeOrg]);

  // ─── Feature check helper ─────────────────────────────────────
  const hasFeature = useCallback((key) => {
    // Super admins viewing their own org see everything
    if (isAdmin && !isImpersonating) return true;
    return features.has(key);
  }, [features, isAdmin, isImpersonating]);

  const value = useMemo(() => ({
    currentOrg,
    homeOrg,
    allOrgs,
    features,
    hasFeature,
    isAdmin,
    isImpersonating,
    switchOrg,
    resetOrg,
    orgMembers,
    loading,
  }), [currentOrg, homeOrg, allOrgs, features, hasFeature, isAdmin, isImpersonating, switchOrg, resetOrg, orgMembers, loading]);

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}

export default OrgContext;
