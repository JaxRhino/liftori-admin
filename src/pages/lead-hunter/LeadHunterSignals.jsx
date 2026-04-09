import React, { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, Zap, Target, Heart, CheckCircle, ExternalLink, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantId } from '../../lib/useTenantId';

const SIGNAL_ICONS = {
  website_change: TrendingUp,
  website_down: AlertCircle,
  funding_announcement: Zap,
  job_posting: Target,
  hiring: Target,
  tech_stack_change: AlertCircle,
  revenue_signal: Heart,
  review_growth: Heart,
  partnership_announcement: CheckCircle,
};

export default function LeadHunterSignals() {
  const { tenantId, tenantFilter } = useTenantId();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    signalType: 'all',
    strength: 'all',
    actioned: 'all'
  });
  const [stats, setStats] = useState({
    total: 0,
    byStrength: { low: 0, medium: 0, high: 0, critical: 0 }
  });
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const signalsPerPage = 25;

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRunScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      // Run website scan
      const scanResult = await supabase.functions.invoke('lh-signals', {
        body: { action: 'scan_websites', limit: 25, tenant_id: tenantId }
      });
      if (scanResult.error) throw scanResult.error;

      // Run change detection
      const changeResult = await supabase.functions.invoke('lh-signals', {
        body: { action: 'detect_changes', limit: 50, tenant_id: tenantId }
      });

      const totalSignals = (scanResult.data?.signals_created || 0) + (changeResult.data?.signals_created || 0);
      const totalScanned = (scanResult.data?.scanned || 0) + (changeResult.data?.checked || 0);

      showToast(`Scanned ${totalScanned} companies, found ${totalSignals} new signal(s)`, totalSignals > 0 ? 'success' : 'info');
      await fetchSignals();
    } catch (err) {
      console.error('Signal scan error:', err);
      showToast(`Scan failed: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [filters, currentPage]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      let query = tenantFilter(
        supabase.from('lh_signals').select(`
          *,
          lh_companies(id, name, website, industry)
        `, { count: 'exact' })
      ).gte('detected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Apply filters
      if (filters.signalType !== 'all') {
        query = query.eq('signal_type', filters.signalType);
      }
      if (filters.strength !== 'all') {
        query = query.eq('signal_strength', filters.strength);
      }
      if (filters.actioned === 'true') {
        query = query.eq('is_actioned', true);
      } else if (filters.actioned === 'false') {
        query = query.eq('is_actioned', false);
      }

      const from = (currentPage - 1) * signalsPerPage;
      const to = from + signalsPerPage - 1;
      const { data, count, error } = await query
        .order('detected_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setSignals(data || []);

      // Calculate stats from the full count
      const totalLow = (data || []).filter(s => s.signal_strength === 'low').length;
      const totalMedium = (data || []).filter(s => s.signal_strength === 'medium').length;
      const totalHigh = (data || []).filter(s => s.signal_strength === 'high').length;
      const totalCritical = (data || []).filter(s => s.signal_strength === 'critical').length;

      setStats({
        total: count || 0,
        byStrength: {
          low: totalLow,
          medium: totalMedium,
          high: totalHigh,
          critical: totalCritical
        }
      });
    } catch (err) {
      console.error('Error fetching signals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkActioned = async (signalId) => {
    try {
      const { error } = await supabase
        .from('lh_signals')
        .update({ is_actioned: true, actioned_at: new Date().toISOString() })
        .eq('id', signalId);

      if (error) throw error;
      setSignals(signals.map(s => s.id === signalId ? { ...s, is_actioned: true, actioned_at: new Date().toISOString() } : s));
    } catch (err) {
      console.error('Error marking signal as actioned:', err);
    }
  };

  const getStrengthColor = (strength) => {
    const colors = {
      low: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      high: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      critical: 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    return colors[strength] || colors.low;
  };

  const getSignalIcon = (signalType) => {
    const Icon = SIGNAL_ICONS[signalType] || AlertCircle;
    return Icon;
  };

  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const signalTypes = [
    'all',
    'website_change',
    'funding_announcement',
    'job_posting',
    'tech_stack_change',
    'revenue_signal',
    'partnership_announcement'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-gray-400">Loading signals...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Signal Monitor</h1>
            <p className="text-gray-400">Intent & trigger signals detected across your prospect database</p>
          </div>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-800 text-white font-medium rounded-lg transition-colors disabled:cursor-wait"
          >
            {scanning ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning...</>
            ) : (
              <><Zap size={16} /> Run Signal Scan</>
            )}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">Total Signals (7d)</p>
            <p className="text-white text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">Low</p>
            <p className="text-gray-300 text-2xl font-bold">{stats.byStrength.low}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">Medium</p>
            <p className="text-blue-300 text-2xl font-bold">{stats.byStrength.medium}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">High</p>
            <p className="text-yellow-300 text-2xl font-bold">{stats.byStrength.high}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">Critical</p>
            <p className="text-red-300 text-2xl font-bold">{stats.byStrength.critical}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-gray-400 text-sm">Filter by:</span>
            </div>

            <select
              value={filters.signalType}
              onChange={(e) => setFilters({ ...filters, signalType: e.target.value })}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Signal Types</option>
              {signalTypes.filter(t => t !== 'all').map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>

            <select
              value={filters.strength}
              onChange={(e) => setFilters({ ...filters, strength: e.target.value })}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Strengths</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={filters.actioned}
              onChange={(e) => setFilters({ ...filters, actioned: e.target.value })}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Status</option>
              <option value="false">Not Actioned</option>
              <option value="true">Actioned</option>
            </select>
          </div>
        </div>

        {/* Signal Feed */}
        {signals.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">No signals detected yet. Signals will appear as Lead Hunter monitors your prospect database.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map(signal => {
              const Icon = getSignalIcon(signal.signal_type);
              return (
                <div
                  key={signal.id}
                  className={`bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-start gap-4 hover:border-slate-600/50 transition ${
                    signal.is_actioned ? 'opacity-60' : ''
                  }`}
                >
                  {/* Icon & Strength */}
                  <div className="flex flex-col items-center gap-2 pt-1 flex-shrink-0">
                    <div className={`p-2 rounded-lg ${getStrengthColor(signal.signal_strength)}`}>
                      <Icon size={18} />
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStrengthColor(signal.signal_strength)}`}>
                      {signal.signal_strength.charAt(0).toUpperCase() + signal.signal_strength.slice(1)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="mb-1">
                      <h3 className="text-white font-semibold">{signal.lh_companies?.name}</h3>
                      <p className="text-sky-400 text-sm hover:underline cursor-pointer">
                        {signal.title}
                      </p>
                    </div>
                    {signal.description && (
                      <p className="text-gray-400 text-sm mb-2">{signal.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{signal.lh_companies?.industry}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(signal.detected_at)}</span>
                      {signal.is_actioned && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">Actioned</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!signal.is_actioned && (
                      <button
                        onClick={() => handleMarkActioned(signal.id)}
                        className="px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded text-xs font-medium transition"
                      >
                        Action
                      </button>
                    )}
                    <a
                      href={signal.lh_companies?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-700/30 hover:bg-slate-700 text-gray-400 hover:text-gray-300 rounded transition"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {stats.total > signalsPerPage && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-400">
            Showing {(currentPage - 1) * signalsPerPage + 1}-{Math.min(currentPage * signalsPerPage, stats.total)} of {stats.total} signals
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-slate-800 border border-slate-700/50 rounded-lg text-gray-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-400">
              Page {currentPage} of {Math.ceil(stats.total / signalsPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(stats.total / signalsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(stats.total / signalsPerPage)}
              className="px-3 py-1 text-sm bg-slate-800 border border-slate-700/50 rounded-lg text-gray-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-sky-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
