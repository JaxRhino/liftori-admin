export default function Commissions() {
  const capabilities = [
    {
      title: 'Personal Commission Dashboard',
      description: 'Every sales rep and affiliate sees their own real-time earnings — closed deals, pending payouts, commission rate, bonus tiers, and year-to-date totals. One glance tells you exactly where you stand.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      title: 'Affiliate Commission Portal',
      description: 'White-labeled commission view for affiliates on their own portals. Track referral conversions, see per-client earnings, download payout history, and share referral links — all branded to Liftori.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      title: 'Tiered Commission Rates',
      description: 'Configure commission structures per role: flat percentage, tiered brackets, bonus accelerators, and override commissions for team leads. Rates auto-apply based on deal size and rep level.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      title: 'Sales Leaderboard',
      description: 'Real-time leaderboard ranked by closed revenue, deal count, or commission earned. Weekly, monthly, quarterly, and all-time views. Drives healthy competition and surfaces top performers.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-7.54 0" />
        </svg>
      ),
    },
    {
      title: 'Deal-Level Commission Tracking',
      description: 'Every project in the pipeline shows its commission value. See who sold it, what rate applies, split commissions for co-sells, and track from estimate approval through final payout.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      title: 'Automated Payout Scheduling',
      description: 'Set payout cadence per rep or affiliate — weekly, biweekly, monthly, or on milestone. Auto-calculates net commission after adjustments, holds, and chargebacks. Syncs directly to Finance Hub.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      title: 'Commission Splits & Overrides',
      description: 'Support complex comp structures: split commissions between co-sellers, manager overrides on team deals, referral bonuses for affiliates, and recurring revenue commissions on managed service contracts.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      title: 'Earnings Forecasting',
      description: 'Project future commissions based on pipeline deals and close probability. See best-case, expected, and worst-case earnings for the month and quarter. Helps reps plan and managers forecast payroll.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
    },
  ];

  const commissionStatuses = [
    { label: 'Earned', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', description: 'Deal closed, commission calculated' },
    { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', description: 'Awaiting approval or payment milestone' },
    { label: 'Approved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', description: 'Reviewed and cleared for payout' },
    { label: 'Scheduled', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', description: 'Queued for next payout cycle' },
    { label: 'Paid', color: 'bg-green-500/20 text-green-400 border-green-500/30', description: 'Funds transferred to rep/affiliate' },
    { label: 'Held', color: 'bg-red-500/20 text-red-400 border-red-500/30', description: 'On hold — dispute, chargeback, or adjustment' },
  ];

  const roleTypes = [
    { role: 'Sales Rep', rate: '10–15%', scope: 'Direct-sold deals', payout: 'Biweekly' },
    { role: 'Team Lead', rate: '3–5% override', scope: 'Team member deals', payout: 'Monthly' },
    { role: 'Affiliate', rate: '8–12%', scope: 'Referral conversions', payout: 'Monthly' },
    { role: 'Partner', rate: 'Custom', scope: 'White-label / co-sell', payout: 'Per agreement' },
  ];

  const flowSteps = [
    { step: '1', label: 'Deal Closes', detail: 'Agreement signed, project moves to "Under Contract"' },
    { step: '2', label: 'Commission Calculated', detail: 'Rate applied based on rep role, deal size, and tier' },
    { step: '3', label: 'Manager Review', detail: 'Team lead reviews splits, overrides, and adjustments' },
    { step: '4', label: 'Approved for Payout', detail: 'Syncs to Finance Hub commission batch' },
    { step: '5', label: 'Payout Processed', detail: 'Funds scheduled and transferred on cadence' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/20 via-navy-800/60 to-green-600/20 border border-emerald-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Commissions</h1>
              <p className="text-emerald-300/70 text-sm">Sales rep & affiliate earnings center</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Track, manage, and pay commissions for every deal in your pipeline. Sales reps see their personal dashboards,
            affiliates track referral earnings on their portals, and everything syncs to the Finance Hub for batch payouts.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-300 text-xs font-medium">Coming Soon — Linked to Finance Hub</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Commission Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                  {cap.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-1">{cap.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{cap.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commission Lifecycle */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Commission Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="flex flex-wrap gap-3 mb-6">
            {commissionStatuses.map((s, i) => (
              <div key={i} className={`px-3 py-2 rounded-lg border ${s.color} text-xs`}>
                <span className="font-semibold">{s.label}</span>
                <span className="hidden sm:inline ml-2 opacity-70">— {s.description}</span>
              </div>
            ))}
          </div>
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-emerald-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold relative z-10">
                    {s.step}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-medium text-white">{s.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Commission Structure */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Commission Structure by Role</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
          <div className="grid grid-cols-4 gap-px bg-navy-700/30">
            <div className="bg-navy-800 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</div>
            <div className="bg-navy-800 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rate</div>
            <div className="bg-navy-800 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Scope</div>
            <div className="bg-navy-800 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Payout</div>
          </div>
          {roleTypes.map((r, i) => (
            <div key={i} className="grid grid-cols-4 gap-px bg-navy-700/30">
              <div className="bg-navy-800/80 px-4 py-3 text-sm font-medium text-white">{r.role}</div>
              <div className="bg-navy-800/80 px-4 py-3 text-sm text-emerald-400 font-mono">{r.rate}</div>
              <div className="bg-navy-800/80 px-4 py-3 text-xs text-gray-400">{r.scope}</div>
              <div className="bg-navy-800/80 px-4 py-3 text-xs text-gray-400">{r.payout}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Finance Hub Link */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 via-navy-800/50 to-blue-500/10 border border-emerald-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.135a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Linked to Finance Hub</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Approved commissions automatically flow to the Finance Hub's Commission Batches for batch processing,
              payout execution, and financial reporting. Sales-side tracking here, finance-side processing there —
              one unified system.
            </p>
          </div>
        </div>
      </div>

      {/* Aspirational Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Reps', value: '—', sub: 'Sales team' },
          { label: 'This Month', value: '$0', sub: 'Commissions earned' },
          { label: 'Pending Payout', value: '$0', sub: 'Awaiting approval' },
          { label: 'Affiliate Partners', value: '—', sub: 'Referral network' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-emerald-400 font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
