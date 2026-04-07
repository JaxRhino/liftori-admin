export default function Estimates() {
  const capabilities = [
    {
      title: 'AI-Powered Estimate Generator',
      description: 'Describe what the client needs in plain English and AI generates a detailed line-item estimate with hours, costs, and timeline. Pulls from historical project data to improve accuracy over time.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      ),
    },
    {
      title: 'Tier-Aware Pricing',
      description: 'Estimates auto-validate against Liftori pricing tiers (Starter, Growth, Scale). Flags scope creep, suggests tier upgrades, and calculates margin impact. Built-in guardrails prevent under-quoting.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Line-Item Breakdown',
      description: 'Every estimate itemized: design, development, integrations, testing, deployment, managed services. Drag to reorder, toggle optional items, add custom line items. Clients see exactly what they\'re paying for.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
    },
    {
      title: 'Client-Facing Estimate Portal',
      description: 'Send a branded, interactive estimate link. Clients can view scope details, toggle optional add-ons, see price update in real-time, leave comments, and approve — all without logging in.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      ),
    },
    {
      title: 'Estimate → Agreement Pipeline',
      description: 'One click converts an approved estimate into a binding agreement pre-populated with scope, pricing, milestones, and terms. Flows directly into the e-signature workflow. Zero re-entry.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      ),
    },
    {
      title: 'Version History & Comparisons',
      description: 'Track every revision with full diff view. Compare v1 to v3 side-by-side. See who changed what, when, and why. Roll back to any previous version instantly.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Pending Estimates Dashboard',
      description: 'At-a-glance view of all outstanding estimates: sent, viewed, expiring soon, approved, declined. Track conversion rate, average approval time, and revenue in pipeline.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
    },
    {
      title: 'Scope Creep Detection',
      description: 'AI monitors project progress against the original estimate. Flags when actual work exceeds quoted scope, auto-generates change order estimates, and alerts before margin erosion happens.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
  ]

  const statuses = [
    { label: 'Draft', count: '—', color: 'bg-gray-500/20 text-gray-400' },
    { label: 'Sent', count: '—', color: 'bg-sky-500/20 text-sky-400' },
    { label: 'Viewed', count: '—', color: 'bg-violet-500/20 text-violet-400' },
    { label: 'Approved', count: '—', color: 'bg-emerald-500/20 text-emerald-400' },
    { label: 'Declined', count: '—', color: 'bg-red-500/20 text-red-400' },
    { label: 'Expired', count: '—', color: 'bg-amber-500/20 text-amber-400' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Estimates</h1>
            <p className="text-gray-400 text-sm">Quote Generation, Pricing & Pending Approvals</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Coming Soon
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl mt-4">
          Generate accurate project estimates in seconds, not hours. AI breaks down scope into line items,
          validates against your pricing tiers, and sends interactive estimates clients can approve with one click.
          Approved estimates flow directly into agreements and project kickoff.
        </p>
      </div>

      {/* Status Pipeline Preview */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-10">
        {statuses.map((s, i) => (
          <div key={i} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.count}</p>
            <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {capabilities.map((cap, i) => (
          <div key={i} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 hover:border-navy-600/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                {cap.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{cap.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{cap.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estimate → Agreement Flow */}
      <div className="bg-navy-800/30 border border-navy-700/30 rounded-xl p-6 mb-10">
        <h2 className="text-lg font-semibold text-white mb-5">Estimate → Agreement → Project Flow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { step: '01', title: 'Wizard Complete', desc: 'Client submits project idea', color: 'text-gray-400' },
            { step: '02', title: 'Estimate Generated', desc: 'AI builds line-item quote', color: 'text-sky-400' },
            { step: '03', title: 'Client Approves', desc: 'Interactive portal review', color: 'text-purple-400' },
            { step: '04', title: 'Agreement Signed', desc: 'Auto-generated contract', color: 'text-brand-blue' },
            { step: '05', title: 'Project Kicks Off', desc: 'Pipeline + milestone setup', color: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className={`text-xl font-bold ${item.color} opacity-40 mb-1`}>{item.step}</div>
              <h4 className="text-xs font-medium text-white mb-0.5">{item.title}</h4>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Tier Guardrails */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { tier: 'Starter', range: 'From $1,500', features: 'Landing pages, simple web apps, single-feature builds', color: 'border-sky-500/30 bg-sky-500/5' },
          { tier: 'Growth', range: 'From $5,000 + $1–2K/mo', features: 'Full platforms, dashboards, integrations, managed services', color: 'border-purple-500/30 bg-purple-500/5' },
          { tier: 'Scale', range: 'From $15,000 + $2–5K/mo', features: 'Enterprise builds, multi-tenant, AI features, white-label', color: 'border-amber-500/30 bg-amber-500/5' },
        ].map((tier, i) => (
          <div key={i} className={`rounded-xl border p-5 ${tier.color}`}>
            <h3 className="text-sm font-semibold text-white mb-1">{tier.tier}</h3>
            <p className="text-lg font-bold text-white mb-2">{tier.range}</p>
            <p className="text-xs text-gray-400">{tier.features}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
