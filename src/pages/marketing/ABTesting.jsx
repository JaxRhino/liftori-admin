export default function ABTesting() {
  const capabilities = [
    {
      title: 'Visual Test Builder',
      description: 'Create A/B tests without code. Point-and-click editor lets you change headlines, images, CTAs, and layouts. See variants side-by-side before launch.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 5.385 4.365 9.75 9.75 9.75S21.75 12.135 21.75 6.75 17.385 0 12 0 2.25 1.615 2.25 6.75z" />
        </svg>
      ),
    },
    {
      title: 'Multi-Variant Testing',
      description: 'Go beyond A/B with multivariate tests. Test multiple elements simultaneously and find the optimal combination with statistical confidence.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Statistical Engine',
      description: 'Built-in statistical significance calculator. Know exactly when a test has enough data to declare a winner — no more guessing or stopping too early.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Landing Page Tests',
      description: 'Test entire landing page variants against each other. Traffic splitting, conversion tracking, and winner auto-deployment built in.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.135a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
      ),
    },
    {
      title: 'Email Subject Line Testing',
      description: 'A/B test email subject lines, preview text, sender names, and send times. Auto-send the winner to the remaining list.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Ad Creative Testing',
      description: 'Run structured creative tests across ad platforms. Test images, copy, CTAs, and audiences with proper experiment design.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Test Archive & Learnings',
      description: 'Every completed test is logged with results, insights, and screenshots. Build an institutional knowledge base of what works for your brand.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3.042.525A9.006 9.006 0 015.25 2h13.5A9.006 9.006 0 0121 3.75c-.981-.345-1.99-.525-3.042-.525A8.967 8.967 0 0012 6.042zm0 0A8.97 8.97 0 0612 16.5A8.97 8.97 0 0012 22.5a8.97 8.97 0 006-6A8.97 8.97 0 0012 6.042z" />
        </svg>
      ),
    },
    {
      title: 'Revenue Impact Calculator',
      description: 'See the dollar impact of winning variants. "Headline B increased conversions by 23%, projected to generate $12K additional revenue this quarter."',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const flowSteps = [
    { step: '1', label: 'Hypothesis', detail: 'Define what you want to test and why' },
    { step: '2', label: 'Design', detail: 'Create test variants without code' },
    { step: '3', label: 'Launch', detail: 'Deploy traffic split and begin collecting data' },
    { step: '4', label: 'Monitor', detail: 'Watch results in real-time' },
    { step: '5', label: 'Analyze', detail: 'Confirm statistical significance' },
    { step: '6', label: 'Implement', detail: 'Deploy winner and document learnings' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600/20 via-navy-800/60 to-teal-600/20 border border-cyan-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">A/B Testing Lab</h1>
              <p className="text-cyan-300/70 text-sm">Controlled experiments platform</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Test everything. Headlines, CTAs, landing pages, emails, ads — run controlled experiments that prove what works. Data-driven decisions, not gut feelings.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-cyan-300 text-xs font-medium">Coming Soon — Data-Driven Testing</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Testing Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
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

      {/* Lifecycle Flow */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Test Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-cyan-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm font-bold relative z-10">
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
          { label: 'Unlimited Tests', value: '∞', sub: 'Test at will' },
          { label: 'Statistical Rigor', value: '95%', sub: 'Confidence level' },
          { label: 'Auto-Winner', value: 'Instant', sub: 'One-click deploy' },
          { label: 'Revenue Impact', value: '360°', sub: 'Dollar attribution' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-cyan-400 font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
