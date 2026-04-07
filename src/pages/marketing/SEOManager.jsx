export default function SEOManager() {
  const capabilities = [
    {
      title: 'Keyword Tracker',
      description: 'Track rankings for hundreds of keywords across Google, Bing, and YouTube. Daily updates with historical trend charts and competitor comparisons.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Site Audit Engine',
      description: 'Automated technical SEO audits that scan for broken links, slow pages, missing meta tags, duplicate content, and mobile issues. Prioritized fix list.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Backlink Monitor',
      description: 'Track your backlink profile in real-time. Get alerts for new, lost, or toxic backlinks. Disavow tool integration and link building opportunity finder.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.135a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
      ),
    },
    {
      title: 'Content Gap Analysis',
      description: 'AI identifies keywords your competitors rank for that you don\'t. Prioritized list of content opportunities with estimated traffic and difficulty.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.98-3.467l2.9-.823c.054-.015.106-.029.16-.042m-15.738 0a2.25 2.25 0 00-.422.149m15.94 5.6-1.32.377a1.803 1.803 0 11-.98-3.467L17.5 13.5m6-4.243A2.25 2.25 0 0020.685 7.17c.591-.264 1.243.87.878 1.235m-5.604-.882a2.25 2.25 0 00-1.32.377m15.738 5.6-1.32.377a1.803 1.803 0 11-.98-3.467l2.9-.823c.054-.015.106-.029.16-.042" />
        </svg>
      ),
    },
    {
      title: 'Local SEO Optimizer',
      description: 'Manage Google Business profiles, track local pack rankings, monitor reviews, and optimize for near-me searches. Multi-location support.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
    },
    {
      title: 'Page Speed Monitor',
      description: 'Track Core Web Vitals and page speed scores across all client sites. Get alerts when performance drops and automated fix recommendations.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Rank Forecasting',
      description: 'AI predicts when you\'ll reach page 1 for target keywords based on current trajectory. Model the impact of content, links, and technical changes.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLineCap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      title: 'Client SEO Reports',
      description: 'White-labeled SEO reports for clients. Automated monthly summaries showing ranking improvements, traffic growth, and ROI calculations.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
    },
  ];

  const flowSteps = [
    { step: '1', label: 'Audit', detail: 'Comprehensive technical and content audit of your site' },
    { step: '2', label: 'Research', detail: 'Identify target keywords and competitive opportunities' },
    { step: '3', label: 'Optimize', detail: 'Create and publish optimized content and technical fixes' },
    { step: '4', label: 'Build Links', detail: 'Execute link building strategy to boost authority' },
    { step: '5', label: 'Track', detail: 'Monitor rankings and performance daily' },
    { step: '6', label: 'Report', detail: 'Generate insights and client reports' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lime-600/20 via-navy-800/60 to-green-500/20 border border-lime-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-lime-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-lime-500/20 border border-lime-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">SEO Manager</h1>
              <p className="text-lime-300/70 text-sm">Rank domination</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Dominate search rankings with AI-powered SEO management. Track keywords, audit your sites, monitor backlinks, and outrank the competition — all automated.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime-500/10 border border-lime-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
            </span>
            <span className="text-lime-300 text-xs font-medium">Coming Soon — White-Label Reports</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">SEO Manager Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-lime-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400 group-hover:bg-lime-500/20 transition-colors">
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

      {/* Marketing Lifecycle */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">SEO Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-lime-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-lime-500/20 border border-lime-500/30 flex items-center justify-center text-lime-400 text-sm font-bold relative z-10">
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

      {/* Aspirational Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '500+ Keywords', value: 'Unlimited', sub: 'Track as many as needed' },
          { label: 'Daily Updates', value: 'Real-Time', sub: 'Live ranking tracking' },
          { label: 'Full Audits', value: 'Automated', sub: 'Weekly comprehensive scans' },
          { label: 'White-Label Reports', value: 'Professional', sub: 'Client-ready templates' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-sm font-semibold text-lime-400">{s.value}</p>
            <p className="text-xs text-white font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
