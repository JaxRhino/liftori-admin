/**
 * OrgSwitcher — Admin context switcher for viewing customer LABOS tenants
 *
 * Shows in the top nav header. For admins, displays which org they're viewing
 * with a dropdown to switch to any customer org. Shows a purple impersonation
 * banner when viewing a customer's platform.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../lib/OrgContext';

export default function OrgSwitcher() {
  const navigate = useNavigate();
  const { currentOrg, allOrgs, isAdmin, isImpersonating, switchOrg, resetOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Only admins see the switcher, hide when viewing customer org
  if (!isAdmin || !currentOrg || isImpersonating) return null;

  const filteredOrgs = allOrgs.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q) || o.industry?.toLowerCase().includes(q);
  });

  const tierColors = {
    internal: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    business: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    growth: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <>
      {/* Org Switcher Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isImpersonating
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25'
              : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
          }`}
        >
          {/* Org icon */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <span className="max-w-[120px] truncate">{currentOrg.name}</span>
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-navy-800 border border-navy-600 rounded-xl shadow-2xl overflow-hidden z-50">
            {/* Search */}
            <div className="p-2 border-b border-navy-700">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className="w-full px-3 py-1.5 bg-navy-900/50 border border-navy-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                autoFocus
              />
            </div>

            {/* Org List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => {
                    if (org.id === currentOrg.id) { setOpen(false); return; }
                    switchOrg(org.id);
                    setOpen(false);
                    setSearch('');
                    // Always land on the customer dashboard after switching orgs
                    navigate('/admin');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    org.id === currentOrg.id
                      ? 'bg-sky-500/10 border-l-2 border-sky-500'
                      : 'hover:bg-navy-700/50 border-l-2 border-transparent'
                  }`}
                >
                  {/* Org avatar */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    org.plan_tier === 'internal' ? 'bg-sky-500/20 text-sky-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {org.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{org.name}</div>
                    <div className="text-xs text-gray-500 truncate">{org.industry || org.slug}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tierColors[org.plan_tier] || tierColors.starter}`}>
                    {org.plan_tier === 'internal' ? 'ADMIN' : org.plan_tier?.toUpperCase()}
                  </span>
                </button>
              ))}

              {filteredOrgs.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-gray-500">No organizations found</div>
              )}
            </div>

            {/* Role previews — role-based UIs that aren't org-scoped */}
            <div className="border-t border-navy-700 bg-navy-900/40">
              <div className="px-3 pt-2 pb-1 text-[9px] uppercase font-bold text-gray-500 tracking-wider">Role previews</div>
              <button
                onClick={() => { setOpen(false); setSearch(''); navigate('/affiliate') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-navy-700/50 border-l-2 border-transparent transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center text-xs font-bold flex-shrink-0">🎨</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">Creator / Affiliate</div>
                  <div className="text-xs text-gray-500 truncate">Preview the creator platform</div>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-pink-500/20 text-pink-400 border-pink-500/30">PREVIEW</span>
              </button>
              <button
                onClick={() => { setOpen(false); setSearch(''); navigate('/admin/tester-dashboard') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-navy-700/50 border-l-2 border-transparent transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold flex-shrink-0">🧪</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">Tester Dashboard</div>
                  <div className="text-xs text-gray-500 truncate">Preview the tester experience</div>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-sky-500/20 text-sky-400 border-sky-500/30">PREVIEW</span>
              </button>
            </div>

            {/* Footer */}
            {isImpersonating && (
              <div className="p-2 border-t border-navy-700">
                <button
                  onClick={() => { resetOrg(); setOpen(false); navigate('/admin'); }}
                  className="w-full px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-semibold text-purple-400 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  Back to Liftori Admin
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
