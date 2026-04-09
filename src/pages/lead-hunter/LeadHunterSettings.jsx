import React, { useEffect, useState } from 'react';
import { Save, Eye, EyeOff, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantId } from '../../lib/useTenantId';

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Retail',
  'Manufacturing',
  'Real Estate',
  'Education',
  'Energy',
  'Telecommunications',
  'Media & Entertainment'
];

const EMPLOYEE_RANGES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' }
];

const REVENUE_RANGES = [
  { value: '0-1M', label: '$0-1M' },
  { value: '1M-10M', label: '$1M-10M' },
  { value: '10M-50M', label: '$10M-50M' },
  { value: '50M-100M', label: '$50M-100M' },
  { value: '100M+', label: '$100M+' }
];

export default function LeadHunterSettings() {
  const { tenantId, tenantFilter } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({
    icp_definition: {
      industries: [],
      employee_ranges: [],
      revenue_ranges: [],
      scoring_weights: {
        icp_fit: 0.25,
        digital_need: 0.25,
        budget_signal: 0.25,
        timing_signal: 0.25
      }
    },
    daily_search_limit: 100,
    daily_enrichment_limit: 500,
    daily_email_limit: 100,
    monthly_budget_cents: 50000,
    send_window_start: '09:00',
    send_window_end: '17:00',
    send_window_timezone: 'America/New_York',
    from_name: 'Sales Team',
    from_email: 'sales@company.com',
    api_keys: {
      google_places: '',
      hunter_io: '',
      people_data_labs: '',
      abstract: ''
    }
  });
  const [revealed, setRevealed] = useState({});
  const [saved, setSaved] = useState(false);
  const [currentMonthSpend, setCurrentMonthSpend] = useState(0);
  const [testingApi, setTestingApi] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    fetchSettings();
    fetchCurrentSpend();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await tenantFilter(
        supabase.from('lh_settings').select('*')
      ).single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        const sendWindow = data.default_send_window || {};
        setFormData({
          icp_definition: data.icp_definition || formData.icp_definition,
          daily_search_limit: data.daily_search_limit || 100,
          daily_enrichment_limit: data.daily_enrichment_limit || 500,
          daily_email_limit: data.daily_email_limit || 100,
          monthly_budget_cents: data.monthly_budget_cents || 50000,
          send_window_start: sendWindow.start || '09:00',
          send_window_end: sendWindow.end || '17:00',
          send_window_timezone: sendWindow.timezone || 'America/New_York',
          from_name: data.email_from_name || 'Liftori Sales',
          from_email: data.email_from_address || 'hello@liftori.ai',
          api_keys: {
            google_places: data.google_places_api_key || '',
            hunter_io: data.hunter_api_key || '',
            people_data_labs: data.pdl_api_key || '',
            abstract: data.abstract_api_key || '',
          }
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSpend = async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await tenantFilter(
        supabase.from('lh_enrichment_log').select('cost_cents')
      ).gte('created_at', monthStart);

      if (error) throw error;
      const totalCents = (data || []).reduce((sum, log) => sum + (log.cost_cents || 0), 0);
      setCurrentMonthSpend(totalCents / 100);
    } catch (err) {
      console.error('Error fetching spend:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaved(false);
      const settingsData = {
        icp_definition: formData.icp_definition,
        daily_search_limit: formData.daily_search_limit,
        daily_enrichment_limit: formData.daily_enrichment_limit,
        daily_email_limit: formData.daily_email_limit,
        monthly_budget_cents: formData.monthly_budget_cents,
        default_send_window: {
          start: formData.send_window_start,
          end: formData.send_window_end,
          timezone: formData.send_window_timezone,
        },
        email_from_name: formData.from_name,
        email_from_address: formData.from_email,
        google_places_api_key: formData.api_keys.google_places || null,
        hunter_api_key: formData.api_keys.hunter_io || null,
        pdl_api_key: formData.api_keys.people_data_labs || null,
        abstract_api_key: formData.api_keys.abstract || null,
      };

      let error;
      if (settings) {
        const response = await supabase
          .from('lh_settings')
          .update(settingsData)
          .eq('id', settings.id);
        error = response.error;
      } else {
        const response = await supabase
          .from('lh_settings')
          .insert([{ ...settingsData, tenant_id: tenantId }]);
        error = response.error;
      }

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const handleTestApi = async (apiKey) => {
    setTestingApi(apiKey);
    try {
      let isValid = false;
      const keyValue = formData.api_keys[apiKey];

      // Simple format validation for demo
      switch (apiKey) {
        case 'google_places':
          isValid = keyValue.length > 20 && keyValue.startsWith('AIza');
          break;
        case 'hunter_io':
          isValid = keyValue.length > 10;
          break;
        case 'people_data_labs':
          isValid = keyValue.length > 10;
          break;
        case 'abstract':
          isValid = keyValue.length > 10;
          break;
      }

      setTestResults({
        ...testResults,
        [apiKey]: { success: isValid, message: isValid ? 'Valid API key format' : 'Invalid API key format' }
      });
    } catch (err) {
      setTestResults({
        ...testResults,
        [apiKey]: { success: false, message: 'Connection test failed' }
      });
    } finally {
      setTestingApi(null);
    }
  };

  const toggleScoreWeight = (fieldName) => {
    setRevealed({
      ...revealed,
      [fieldName]: !revealed[fieldName]
    });
  };

  const updateScoringWeights = (field, value) => {
    const newWeights = {
      ...formData.icp_definition.scoring_weights,
      [field]: parseFloat(value)
    };
    setFormData({
      ...formData,
      icp_definition: {
        ...formData.icp_definition,
        scoring_weights: newWeights
      }
    });
  };

  const totalWeight = Object.values(formData.icp_definition.scoring_weights).reduce((a, b) => a + b, 0);

  const toggleIndustry = (industry) => {
    const industries = formData.icp_definition.industries.includes(industry)
      ? formData.icp_definition.industries.filter(i => i !== industry)
      : [...formData.icp_definition.industries, industry];

    setFormData({
      ...formData,
      icp_definition: {
        ...formData.icp_definition,
        industries
      }
    });
  };

  const toggleEmployeeRange = (range) => {
    const ranges = formData.icp_definition.employee_ranges.includes(range)
      ? formData.icp_definition.employee_ranges.filter(r => r !== range)
      : [...formData.icp_definition.employee_ranges, range];

    setFormData({
      ...formData,
      icp_definition: {
        ...formData.icp_definition,
        employee_ranges: ranges
      }
    });
  };

  const toggleRevenueRange = (range) => {
    const ranges = formData.icp_definition.revenue_ranges.includes(range)
      ? formData.icp_definition.revenue_ranges.filter(r => r !== range)
      : [...formData.icp_definition.revenue_ranges, range];

    setFormData({
      ...formData,
      icp_definition: {
        ...formData.icp_definition,
        revenue_ranges: ranges
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Lead Hunter Settings</h1>
          <p className="text-gray-400">Configure your Lead Hunter instance</p>
        </div>

        {/* Saved Notification */}
        {saved && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-300">
            <Check size={18} />
            Settings saved successfully
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* ICP Definition */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">ICP Definition</h2>
            <div className="space-y-4">
              {/* Industries */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">Target Industries</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(industry => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => toggleIndustry(industry)}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        formData.icp_definition.industries.includes(industry)
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Range */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">Employee Range</label>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYEE_RANGES.map(range => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => toggleEmployeeRange(range.value)}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        formData.icp_definition.employee_ranges.includes(range.value)
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Revenue Range */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">Revenue Range</label>
                <div className="flex flex-wrap gap-2">
                  {REVENUE_RANGES.map(range => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => toggleRevenueRange(range.value)}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        formData.icp_definition.revenue_ranges.includes(range.value)
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scoring Weights */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-gray-300 text-sm font-medium">Scoring Weights</label>
                  <span className={`text-xs font-medium ${totalWeight === 1 ? 'text-green-400' : 'text-red-400'}`}>
                    Total: {totalWeight.toFixed(2)} {totalWeight === 1 ? '✓' : '(must equal 1.0)'}
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(formData.icp_definition.scoring_weights).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-gray-400 text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                        <span className="text-white font-semibold text-sm">{(value * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        onChange={(e) => updateScoringWeights(key, e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rate Limits & Budget */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Rate Limits & Budget</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Daily Search Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.daily_search_limit}
                    onChange={(e) => setFormData({ ...formData, daily_search_limit: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Daily Enrichment Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.daily_enrichment_limit}
                    onChange={(e) => setFormData({ ...formData, daily_enrichment_limit: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Daily Email Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.daily_email_limit}
                    onChange={(e) => setFormData({ ...formData, daily_email_limit: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Monthly Budget</label>
                  <div className="flex gap-2">
                    <span className="flex items-center text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      value={(formData.monthly_budget_cents / 100).toFixed(2)}
                      onChange={(e) => setFormData({ ...formData, monthly_budget_cents: Math.round(parseFloat(e.target.value) * 100) })}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/30 border border-slate-600/30 rounded p-3">
                <p className="text-gray-400 text-sm mb-1">Current Month Spend</p>
                <p className="text-white text-lg font-semibold">${(currentMonthSpend / 100).toFixed(2)}</p>
                <p className="text-gray-500 text-xs mt-1">Remaining: ${((formData.monthly_budget_cents - currentMonthSpend) / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Outreach Defaults */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Outreach Defaults</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Send Window Start</label>
                  <input
                    type="time"
                    value={formData.send_window_start}
                    onChange={(e) => setFormData({ ...formData, send_window_start: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Send Window End</label>
                  <input
                    type="time"
                    value={formData.send_window_end}
                    onChange={(e) => setFormData({ ...formData, send_window_end: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Timezone</label>
                  <select
                    value={formData.send_window_timezone}
                    onChange={(e) => setFormData({ ...formData, send_window_timezone: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="America/New_York">Eastern</option>
                    <option value="America/Chicago">Central</option>
                    <option value="America/Denver">Mountain</option>
                    <option value="America/Los_Angeles">Pacific</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">From Name</label>
                  <input
                    type="text"
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">From Email</label>
                  <input
                    type="email"
                    value={formData.from_email}
                    onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">API Keys</h2>
            <div className="space-y-4">
              {[
                { key: 'google_places', label: 'Google Places API Key' },
                { key: 'hunter_io', label: 'Hunter.io API Key' },
                { key: 'people_data_labs', label: 'People Data Labs API Key' },
                { key: 'abstract', label: 'Abstract API Key' }
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={revealed[key] ? 'text' : 'password'}
                        value={formData.api_keys[key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          api_keys: { ...formData.api_keys, [key]: e.target.value }
                        })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500 pr-10"
                        placeholder="Paste your API key here"
                      />
                      <button
                        type="button"
                        onClick={() => toggleScoreWeight(key)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-300"
                      >
                        {revealed[key] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestApi(key)}
                      disabled={!formData.api_keys[key] || testingApi === key}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-gray-300 rounded transition text-sm font-medium"
                    >
                      {testingApi === key ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  {testResults[key] && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${testResults[key].success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResults[key].success ? <Check size={14} /> : <X size={14} />}
                      {testResults[key].message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              <Save size={18} />
              Save All Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
