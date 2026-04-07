import { useState, useEffect, useCallback } from 'react'

// ─── Config ───────────────────────────────────────────────────
const regionConfig = {
  JAX: { name: 'Jacksonville', color: '#3b82f6' },
  ORL: { name: 'Orlando', color: '#8b5cf6' },
  TAM: { name: 'Tampa', color: '#22c55e' },
  WPB: { name: 'West Palm Beach', color: '#f97316' },
  NAP: { name: 'Naples', color: '#06b6d4' },
  MIA: { name: 'Miami', color: '#ec4899' },
}

const sourceColors = {
  'TV': '#ef4444',
  'Google': '#4285f4',
  'Google LSA': '#34a853',
  'Meta': '#1877f2',
  'Website': '#6366f1',
  'Yard Sign': '#22c55e',
  'Referral': '#f59e0b',
  'Direct': '#64748b',
  'Other': '#94a3b8',
}

// ─── Mock data generators (replace with API calls when backend connects) ──
function generateSources() {
  return Object.keys(sourceColors).map(source => ({
    source,
    total_calls: 40 + Math.floor(Math.random() * 120),
    answered: 30 + Math.floor(Math.random() * 90),
    missed: 3 + Math.floor(Math.random() * 20),
    answer_rate: 65 + Math.floor(Math.random() * 30),
  })).sort((a, b) => b.total_calls - a.total_calls)
}

function generateRegions() {
  return Object.entries(regionConfig).map(([code, config]) => ({
    region_code: code,
    region_name: config.name,
    total_calls: 50 + Math.floor(Math.random() * 150),
    answered: 40 + Math.floor(Math.random() * 110),
    missed: 5 + Math.floor(Math.random() * 25),
  })).sort((a, b) => b.total_calls - a.total_calls)
}

function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => {
    const isBusiness = i >= 8 && i <= 18
    const base = isBusiness ? 15 : 3
    const total = base + Math.floor(Math.random() * (isBusiness ? 25 : 8))
    const answered = Math.floor(total * (0.7 + Math.random() * 0.25))
    return {
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      total,
      answered,
      missed: total - answered,
    }
  })
}

function generateDailyTrends(days) {
  const trends = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const total = 30 + Math.floor(Math.random() * 50)
    const answered = Math.floor(total * (0.7 + Math.random() * 0.2))
    trends.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      total,
      answered,
      missed: total - answered,
    })
  }
  return trends
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function CallCenter() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [sources, setSources] = useState([])
  const [regions, setRegions] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [dailyTrends, setDailyTrends] = useState([])
  const [activeTab, setActiveTab] = useState('sources')

  const fetchDashboardData = useCallback(() => {
    setLoading(true)
    // TODO: Replace with real API calls
    // const [sourcesRes, regionsRes, statusRes] = await Promise.all([
    //   fetch(`/api/settings/call-center/sources`),
    //   fetch(`/api/settings/call-center/regions`),
    //   fetch(`/api/settings/call-center/status`),
    // ])
    setSources(generateSources())
    setRegions(generateRegions())
    setHourlyData(generateHourlyData())
    setDailyTrends(generateDailyTrends(parseInt(dateRange)))
    setLoading(false)
  }, [dateRange])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const totalCalls = sources.reduce((sum, s) => sum + (s.total_calls || 0), 0)
  const totalAnswered = sources.reduce((sum, s) => sum + (s.answered || 0), 0)
  const totalMissed = sources.reduce((sum, s) => sum + (s.missed || 0), 0)
  const overallAnswerRate = totalCalls > 0 ? ((totalAnswered / totalCalls) * 100).toFixed(1) : 0
  const topSource = sources.length > 0 ? sources.reduce((a, b) => (a.total_calls || 0) > (b.total_calls || 0) ? a : b) : null
  const highestMissedRegion = regions.length > 0 ? regions.reduce((a, b) => (a.missed || 0) > (b.missed || 0) ? a : b) : null

  const tabs = [
    { id: 'sources', label: 'By Source', icon: <TagIcon /> },
    { id: 'regions', label: 'By Region', icon: <MapPinIcon /> },
    { id: 'trends', label: 'Trends', icon: <ActivityIcon /> },
    { id: 'hourly', label: 'By Hour', icon: <ClockIcon /> },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Safe Mode Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-sky-500/10 border border-sky-500/20 rounded-lg">
        <ShieldIcon className="text-sky-400" />
        <div className="text-sm">
          <span className="font-semibold text-sky-300">Safe Mode Active</span>
          <span className="text-sky-400/80 ml-2">
            Viewing read-only call analytics. All data is for observation only.
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Source & Volume Dashboards</h1>
          <p className="text-slate-500 text-sm mt-1">
            Analyze call patterns by source, region, and time • {totalCalls.toLocaleString()} total calls tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Calls"
          value={totalCalls.toLocaleString()}
          sub={`Last ${dateRange} days`}
          icon={<PhoneIcon className="text-sky-500/30" />}
        />
        <MetricCard
          label="Answer Rate"
          value={`${overallAnswerRate}%`}
          valueColor="text-green-400"
          sub={
            <span className="flex items-center gap-1">
              {parseFloat(overallAnswerRate) >= 80 ? <TrendUpIcon className="text-green-500" /> : <TrendDownIcon className="text-red-500" />}
              <span>{totalAnswered.toLocaleString()} answered</span>
            </span>
          }
          icon={<CheckIcon className="text-green-500/30" />}
        />
        <MetricCard
          label="Missed Calls"
          value={totalMissed.toLocaleString()}
          valueColor="text-red-400"
          sub={`${totalCalls > 0 ? ((totalMissed / totalCalls) * 100).toFixed(1) : 0}% of total`}
          icon={<PhoneMissedIcon className="text-red-500/30" />}
        />
        <MetricCard
          label="Top Source"
          value={topSource?.source || '—'}
          valueSize="text-xl"
          sub={`${topSource?.total_calls?.toLocaleString() || 0} calls`}
          icon={<TagIcon className="text-purple-500/30 w-10 h-10" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sources' && (
        <SourcesTab sources={sources} totalCalls={totalCalls} loading={loading} />
      )}
      {activeTab === 'regions' && (
        <RegionsTab regions={regions} highestMissedRegion={highestMissedRegion} loading={loading} />
      )}
      {activeTab === 'trends' && (
        <TrendsTab dailyTrends={dailyTrends} loading={loading} />
      )}
      {activeTab === 'hourly' && (
        <HourlyTab hourlyData={hourlyData} loading={loading} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// METRIC CARD
// ═══════════════════════════════════════════════════════════════
function MetricCard({ label, value, valueColor = 'text-white', valueSize = 'text-3xl', sub, icon }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`${valueSize} font-bold ${valueColor}`}>{value}</p>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
        <div className="w-10 h-10">{icon}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SOURCES TAB
// ═══════════════════════════════════════════════════════════════
function SourcesTab({ sources, totalCalls, loading }) {
  if (loading) return <LoadingPlaceholder />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart Card */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-lg">
        <div className="p-4 border-b border-navy-700/30">
          <h3 className="text-white font-semibold">Calls by Source</h3>
          <p className="text-xs text-slate-500 mt-1">Volume distribution across marketing channels</p>
        </div>
        <div className="p-4">
          {sources.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">No source data available</div>
          ) : (
            <div className="space-y-3">
              {sources.slice(0, 10).map(source => {
                const pct = totalCalls > 0 ? (source.total_calls / totalCalls) * 100 : 0
                return (
                  <div key={source.source} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 font-medium">{source.source}</span>
                      <span className="text-slate-500">
                        {source.total_calls?.toLocaleString()} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-navy-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: sourceColors[source.source] || '#64748b' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-lg">
        <div className="p-4 border-b border-navy-700/30">
          <h3 className="text-white font-semibold">Source Performance</h3>
          <p className="text-xs text-slate-500 mt-1">Answer rates and call volume by source</p>
        </div>
        <div className="p-4">
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-navy-700/30">
                  <th className="text-left py-2">Source</th>
                  <th className="text-right py-2">Calls</th>
                  <th className="text-right py-2">Answered</th>
                  <th className="text-right py-2">Missed</th>
                  <th className="text-right py-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(source => (
                  <tr key={source.source} className="border-b border-navy-700/20 last:border-0">
                    <td className="py-2.5 text-slate-300 font-medium">{source.source}</td>
                    <td className="text-right py-2.5 text-slate-400">{source.total_calls?.toLocaleString()}</td>
                    <td className="text-right py-2.5 text-green-400">{source.answered?.toLocaleString()}</td>
                    <td className="text-right py-2.5 text-red-400">{source.missed?.toLocaleString()}</td>
                    <td className="text-right py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        source.answer_rate >= 80
                          ? 'bg-green-500/20 text-green-400'
                          : source.answer_rate >= 60
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {source.answer_rate?.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// REGIONS TAB
// ═══════════════════════════════════════════════════════════════
function RegionsTab({ regions, highestMissedRegion, loading }) {
  if (loading) return <LoadingPlaceholder />
  const totalRegion = regions.reduce((sum, r) => sum + (r.total_calls || 0), 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-lg">
        <div className="p-4 border-b border-navy-700/30">
          <h3 className="text-white font-semibold">Calls by Region</h3>
          <p className="text-xs text-slate-500 mt-1">Volume distribution across service areas</p>
        </div>
        <div className="p-4">
          {regions.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">No region data available</div>
          ) : (
            <div className="space-y-3">
              {regions.map(region => {
                const pct = totalRegion > 0 ? (region.total_calls / totalRegion) * 100 : 0
                const config = regionConfig[region.region_code] || { name: region.region_code, color: '#64748b' }
                return (
                  <div key={region.region_code} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 font-medium">{region.region_name || config.name}</span>
                      <span className="text-slate-500">
                        {region.total_calls?.toLocaleString()} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-navy-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: config.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Region Cards */}
      <div className="space-y-4">
        {regions.map(region => {
          const config = regionConfig[region.region_code] || { name: region.region_code, color: '#64748b' }
          return (
            <div key={region.region_code} className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-10 rounded" style={{ backgroundColor: config.color }} />
                  <div>
                    <h4 className="text-white font-semibold">{region.region_name || config.name}</h4>
                    <p className="text-xs text-slate-500">{region.region_code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{region.total_calls?.toLocaleString()}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">{region.answered} answered</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-red-400">{region.missed} missed</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {highestMissedRegion && highestMissedRegion.missed > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangleIcon className="text-orange-400 flex-shrink-0" />
            <p className="text-sm text-orange-300">
              <strong>{regionConfig[highestMissedRegion.region_code]?.name || highestMissedRegion.region_code}</strong> has the highest missed call rate
              ({highestMissedRegion.missed} missed calls). Consider increasing coverage.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TRENDS TAB
// ═══════════════════════════════════════════════════════════════
function TrendsTab({ dailyTrends, loading }) {
  if (loading) return <LoadingPlaceholder />
  const maxTotal = Math.max(...dailyTrends.map(d => d.total), 1)

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg">
      <div className="p-4 border-b border-navy-700/30">
        <h3 className="text-white font-semibold">Daily Call Trends</h3>
        <p className="text-xs text-slate-500 mt-1">Answered vs missed calls over time</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Stacked bars */}
        <div className="flex items-end gap-[2px] h-48 border-b border-navy-700/30 pb-2">
          {dailyTrends.map((day, i) => {
            const heightPct = (day.total / maxTotal) * 100
            const answeredPct = day.total > 0 ? (day.answered / day.total) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ height: '100%' }}>
                <div className="w-full flex flex-col justify-end h-full">
                  <div className="w-full rounded-t overflow-hidden" style={{ height: `${heightPct}%`, minHeight: '2px' }}>
                    <div className="w-full bg-green-500" style={{ height: `${answeredPct}%` }} />
                    <div className="w-full bg-red-400" style={{ height: `${100 - answeredPct}%` }} />
                  </div>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-navy-700 border border-navy-600 rounded-lg p-2 shadow-lg z-10 text-xs whitespace-nowrap">
                  <p className="text-white font-medium">{day.date}</p>
                  <p className="text-green-400">Answered: {day.answered}</p>
                  <p className="text-red-400">Missed: {day.missed}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>{dailyTrends[0]?.date}</span>
          <span>{dailyTrends[Math.floor(dailyTrends.length / 2)]?.date}</span>
          <span>{dailyTrends[dailyTrends.length - 1]?.date}</span>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500" /> Answered</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-400" /> Missed</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOURLY TAB
// ═══════════════════════════════════════════════════════════════
function HourlyTab({ hourlyData, loading }) {
  if (loading) return <LoadingPlaceholder />
  const maxTotal = Math.max(...hourlyData.map(h => h.total), 1)

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg">
      <div className="p-4 border-b border-navy-700/30">
        <h3 className="text-white font-semibold">Calls by Hour of Day</h3>
        <p className="text-xs text-slate-500 mt-1">Identify peak call times and coverage needs</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Bars */}
        <div className="flex items-end gap-1 h-48 border-b border-navy-700/30 pb-2">
          {hourlyData.map(hour => {
            const heightPct = (hour.total / maxTotal) * 100
            const isBusiness = hour.hour >= 8 && hour.hour <= 18
            return (
              <div key={hour.hour} className="flex-1 flex flex-col items-center group relative" style={{ height: '100%' }}>
                <div className="w-full flex flex-col justify-end h-full">
                  <div
                    className={`w-full rounded-t transition-all hover:opacity-80 ${
                      isBusiness ? 'bg-sky-500' : 'bg-slate-600/50'
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: hour.total > 0 ? '4px' : '0' }}
                  />
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-navy-700 border border-navy-600 rounded-lg p-2 shadow-lg z-10 text-xs whitespace-nowrap">
                  <p className="text-white font-medium">{hour.label}</p>
                  <p className="text-slate-400">Total: {hour.total}</p>
                  <p className="text-green-400">Answered: {hour.answered}</p>
                  <p className="text-red-400">Missed: {hour.missed}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>12am</span>
          <span>6am</span>
          <span>12pm</span>
          <span>6pm</span>
          <span>12am</span>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-sky-500" /> Business Hours</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-600/50" /> After Hours</span>
        </div>

        {/* Peak hours insight */}
        <div className="flex items-center gap-3 px-4 py-3 bg-navy-700/50 border border-navy-600/50 rounded-lg">
          <ClockIcon className="text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-400">
            Peak call volume occurs between <strong className="text-white">10am – 2pm</strong>. Consider ensuring adequate staffing during these hours.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────
function LoadingPlaceholder() {
  return <div className="h-64 flex items-center justify-center text-slate-500">Loading...</div>
}

// ─── Icons (inline SVGs matching lucide-react style) ──────────
function PhoneIcon({ className = '' }) {
  return (
    <svg className={`w-10 h-10 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}

function PhoneMissedIcon({ className = '' }) {
  return (
    <svg className={`w-10 h-10 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg className={`w-10 h-10 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TagIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  )
}

function MapPinIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function ActivityIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function ClockIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ShieldIcon({ className = '' }) {
  return (
    <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

function RefreshIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  )
}

function TrendUpIcon({ className = '' }) {
  return (
    <svg className={`w-3 h-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  )
}

function TrendDownIcon({ className = '' }) {
  return (
    <svg className={`w-3 h-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  )
}

function AlertTriangleIcon({ className = '' }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}
