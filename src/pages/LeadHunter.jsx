export default function LeadHunter() {
  const capabilities = [
    {
      title: 'B2B Company Search',
      description: 'Search millions of businesses by industry, revenue range, employee count, location, and growth signals. Filter by SIC/NAICS codes, tech stack, and funding stage.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18m4.5-18v18M6 6.75h.008v.008H6V6.75zm0 3.75h.008v.008H6v-.008zm0 3.75h.008v.008H6v-.008zm4.5-7.5h.008v.008H10.5V6.75zm0 3.75h.008v.008H10.5v-.008zm0 3.75h.008v.008H10.5v-.008zm4.5-7.5h.008v.008H15V6.75zm0 3.75h.008v.008H15v-.008zm0 3.75h.008v.008H15v-.008z" />
        </svg>
      ),
    },
    {
      title: 'Decision Maker Discovery',
      description: 'Automatically identify C-suite, VPs, directors, and department heads at target companies. Surface verified emails, LinkedIn profiles, and direct phone numbers.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      title: 'Auto-Pilot Prospecting',
      description: 'Set targeting criteria and let Lead Hunter continuously find new prospects matching your ICP. Daily refresh with de-duplication, scoring, and priority ranking.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
        </svg>
      ),
    },
    {
      title: 'Smart Lead Scoring',
      description: 'AI-powered scoring based on fit signals: company size match, budget indicators, tech stack compatibility, growth trajectory, and buying intent signals.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      title: 'Automated Outreach Sequences',
      description: 'Multi-channel outreach: personalized email sequences, LinkedIn connection requests, and SMS follow-ups. AI writes the first draft, you approve and send.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      ),
    },
    {
      title: 'Saved Lists & Segments',
      description: 'Build and manage prospect lists by vertical, geography, or campaign. Export to CRM, enrich on demand, and track engagement across touchpoints.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
    },
    {
      title: 'Intent & Trigger Signals',
      description: 'Monitor hiring patterns, funding rounds, leadership changes, tech adoption, and web activity to catch companies at the exact right buying moment.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      title: 'CRM Sync & Pipeline Push',
      description: 'One-click push qualified leads into your Liftori project pipeline. Auto-create customer records, assign reps, and trigger onboarding workflows.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Hunter</h1>
            <p className="text-gray-400 text-sm">B2B Prospecting & Lead Generation Engine</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Coming Soon
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl mt-4">
          Find your ideal customers before they find your competitors. Lead Hunter scans millions of businesses,
          identifies decision makers, scores them against your ideal customer profile, and feeds qualified
          prospects directly into your sales pipeline — on auto-pilot.
        </p>
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

      {/* How It Works */}
      <div className="bg-navy-800/30 border border-navy-700/30 rounded-xl p-6 mb-10">
        <h2 className="text-lg font-semibold text-white mb-5">How Lead Hunter Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '01', title: 'Define Your ICP', desc: 'Set industry, revenue, size, location, and tech stack filters' },
            { step: '02', title: 'Hunt Leads', desc: 'AI scans databases, enriches data, and scores every match' },
            { step: '03', title: 'Engage Contacts', desc: 'Auto-generate personalized outreach across email, LinkedIn, SMS' },
            { step: '04', title: 'Convert & Track', desc: 'Push qualified leads to pipeline with full engagement history' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-bold text-brand-blue/30 mb-2">{item.step}</div>
              <h4 className="text-sm font-medium text-white mb-1">{item.title}</h4>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Companies in Database', value: '50M+', color: 'text-brand-blue' },
          { label: 'Decision Makers', value: '200M+', color: 'text-purple-400' },
          { label: 'Data Points per Lead', value: '75+', color: 'text-emerald-400' },
          { label: 'Avg. Enrichment Time', value: '<2s', color: 'text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
