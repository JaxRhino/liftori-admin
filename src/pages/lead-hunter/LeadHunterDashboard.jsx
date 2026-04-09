import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Crosshair,
  Plus,
  Upload,
  TrendingUp,
  AlertCircle,
  Zap,
  Activity,
  Search,
  List,
  Mail,
  Radio,
  Settings,
  ExternalLink,
  ArrowRight,
  Clock,
  Loader,
} from 'lucide-react';

export default function LeadHunterDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    enrichedLeads: 0,
    hotLeads: 0,
    activeSequences: 0,
  });
  const [hotLeadsData, setHotLeadsData] = useState([]);
  const [signals, setSignals] = useState([]);
  const [enrichmentLog, setEnrichmentLog] = useState([]);
  const [loadingHotLeads, setLoadingHotLeads] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Total Companies
        const { count: companiesCount } = await supabase
          .from('lh_companies')
          .select('*', { count: 'exact', head: true });

        // Enriched Leads
        const { count: enrichedCount } = await supabase
          .from('lh_companies')
          .select('*', { count: 'exact', head: true })
          .eq('enrichment_status', 'enriched');

        // Hot Leads
        const { count: hotCount } = await supabase
          .from('lh_companies')
          .select('*', { count: 'exact', head: true })
          .gte('lead_score', 80);

        // Active Sequences
        const { count: sequencesCount } = await supabase
          .from('lh_sequences')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        setStats({
          totalCompanies: companiesCount || 0,
          enrichedLeads: enrichedCount || 0,
          hotLeads: hotCount || 0,
          activeSequences: sequencesCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch Hot Leads
  useEffect(() => {
    const fetchHotLeads = async () => {
      setLoadingHotLeads(true);
      try {
        const { data, error } = await supabase
          .from('lh_companies')
          .select('*')
          .gte('lead_score', 80)
          .order('lead_score', { ascending: false })
          .limit(10);

        if (error) throw error;
        setHotLeadsData(data || []);
      } catch (error) {
        console.error('Error fetching hot leads:', error);
        setHotLeadsData([]);
      } finally {
        setLoadingHotLeads(false);
      }
    };

    fetchHotLeads();
  }, []);

  // Fetch Recent Signals
  useEffect(() => {
    const fetchSignals = async () => {
      setLoadingSignals(true);
      try {
        const { data, error } = await supabase
          .from('lh_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setSignals(data || []);
      } catch (error) {
        console.error('Error fetching signals:', error);
        setSignals([]);
      } finally {
        setLoadingSignals(false);
      }
    };

    fetchSignals();
  }, []);

  // Fetch Enrichment Log
  useEffect(() => {
    const fetchEnrichmentLog = async () => {
      setLoadingLog(true);
      try {
        const { data, error } = await supabase
          .from('lh_enrichment_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        setEnrichmentLog(data || []);
      } catch (error) {
        console.error('Error fetching enrichment log:', error);
        setEnrichmentLog([]);
      } finally {
        setLoadingLog(false);
      }
    };

    fetchEnrichmentLog();
  }, []);

  const getScoreBadgeColor = (score) => {
    if (score >= 90) return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (score >= 80) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    if (score >= 70) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    return 'bg-slate-700/50 text-slate-300 border border-slate-600';
  };

  const getSignalIcon = (signalType) => {
    switch (signalType) {
      case 'funding':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'hiring':
        return <Plus className="w-4 h-4 text-blue-400" />;
      case 'news':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'tech_change':
        return <Zap className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const quickActions = [
    {
      icon: <Search className="w-5 h-5" />,
      label: 'Search Companies',
      description: 'Find prospects matching your ICP',
      href: '/admin/lead-hunter/search',
    },
    {
      icon: <List className="w-5 h-5" />,
      label: 'Manage Lists',
      description: 'Organize and segment leads',
      href: '/admin/lead-hunter/lists',
    },
    {
      icon: <Mail className="w-5 h-5" />,
      label: 'Outreach Sequences',
      description: 'Automate multi-touch campaigns',
      href: '/admin/lead-hunter/sequences',
    },
    {
      icon: <Radio className="w-5 h-5" />,
      label: 'Signal Monitor',
      description: 'Track market signals in real-time',
      href: '/admin/lead-hunter/signals',
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      description: 'Configure enrichment sources',
      href: '/admin/lead-hunter/settings',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-slate-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Crosshair className="w-8 h-8 text-sky-500" />
            <h1 className="text-3xl font-bold text-white">Lead Hunter</h1>
          </div>
          <p className="text-slate-400">B2B Prospecting & Lead Generation Engine</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/lead-hunter/search')}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Search
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white font-medium rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            Import Leads
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {/* Total Companies */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm font-medium">Total Companies</p>
            <TrendingUp className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalCompanies}</p>
        </div>

        {/* Enriched Leads */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm font-medium">Enriched Leads</p>
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.enrichedLeads}</p>
        </div>

        {/* Hot Leads */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm font-medium">Hot Leads</p>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.hotLeads}</p>
        </div>

        {/* Active Sequences */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm font-medium">Active Sequences</p>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.activeSequences}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        {/* Hot Leads Section (2/3 width) */}
        <div className="col-span-2">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Hot Leads
            </h2>

            {loadingHotLeads ? (
              <div className="flex justify-center py-12">
                <Loader className="w-6 h-6 text-sky-500 animate-spin" />
              </div>
            ) : hotLeadsData.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">No hot leads yet</p>
                <p className="text-slate-500 text-sm">
                  Start by searching for companies matching your ICP.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Company
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Industry
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Score
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Website Quality
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotLeadsData.map((company) => (
                      <tr
                        key={company.id}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="py-4 px-4 text-white font-medium">
                          {company.name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {company.industry || 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreBadgeColor(
                              company.lead_score || 0
                            )}`}
                          >
                            {company.lead_score || 0}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {company.website_quality || 'Unknown'}
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {company.city && company.state
                            ? `${company.city}, ${company.state}`
                            : 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button className="text-sky-400 hover:text-sky-300 transition-colors text-xs font-medium">
                              View
                            </button>
                            <button className="text-sky-400 hover:text-sky-300 transition-colors text-xs font-medium">
                              Enrich
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(action.href)}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-700/40 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-slate-400 group-hover:text-sky-500 transition-colors">
                      {action.icon}
                    </span>
                    <div>
                      <p className="font-medium text-white group-hover:text-sky-400 transition-colors text-sm">
                        {action.label}
                      </p>
                      <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Signals */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-500" />
              Recent Signals
            </h2>

            {loadingSignals ? (
              <div className="flex justify-center py-8">
                <Loader className="w-5 h-5 text-sky-500 animate-spin" />
              </div>
            ) : signals.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">
                No signals detected yet
              </p>
            ) : (
              <div className="space-y-3">
                {signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-700/20 transition-colors"
                  >
                    <span className="mt-0.5">{getSignalIcon(signal.signal_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {signal.title || 'Signal'}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(signal.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Enrichment Activity */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-500" />
          Recent Enrichment Activity
        </h2>

        {loadingLog ? (
          <div className="flex justify-center py-12">
            <Loader className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : enrichmentLog.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No enrichment activity yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-3 px-4 font-medium text-slate-300">
                    Company
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">
                    Enrichment Source
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">
                    Fields Updated
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrichmentLog.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-4 px-4 text-white font-medium">
                      {entry.source || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-slate-300">
                      {entry.enrichment_source || 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          entry.enrichment_status === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : entry.enrichment_status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {entry.enrichment_status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-300 text-xs">
                      {entry.fields_updated || '—'}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-xs">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
