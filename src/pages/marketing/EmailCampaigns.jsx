export default function EmailCampaigns() {
  const capabilities = [
    {
      title: 'Drag-and-Drop Builder',
      description: 'Beautiful email builder with pre-designed blocks for headers, CTAs, images, testimonials, and footers. No coding required — just drag, drop, and customize.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5V21m0 0H4.5a2.25 2.25 0 01-2.25-2.25V7.5m0 0H21m-18 0h18m-18 0v7.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-7.5m0 0V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v3" />
        </svg>
      ),
    },
    {
      title: 'AI Personalization',
      description: 'Dynamic content blocks that change based on recipient data — name, company, plan tier, last interaction. Every email feels personally written.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      title: 'Drip Sequences',
      description: 'Build automated email sequences triggered by user actions — signup, purchase, inactivity, milestone. Nurture leads on autopilot.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Audience Segmentation',
      description: 'Segment contacts by behavior, demographics, plan tier, engagement level, and custom tags. Send the right message to the right people.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375c-.621 0-1.125-.504-1.125-1.125V7.125z" />
        </svg>
      ),
    },
    {
      title: 'A/B Testing',
      description: 'Test subject lines, send times, content variants, and CTAs. AI automatically sends the winner to the remaining audience for maximum performance.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
    {
      title: 'Template Library',
      description: '50+ professionally designed email templates for announcements, newsletters, promotions, onboarding, and re-engagement. Fully customizable.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0013.5 7.125v-1.36c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h9.375c.621 0 1.125-.504 1.125-1.125v-9.25m0 0a3.375 3.375 0 013.375 3.375m0 0h3.375c.621 0 1.125-.504 1.125-1.125v-9.25" />
        </svg>
      ),
    },
    {
      title: 'Deliverability Monitor',
      description: 'Track inbox placement rates, spam scores, bounce rates, and sender reputation. Get alerts before deliverability issues impact campaigns.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A6 6 0 0015.75 13.5H15" />
        </svg>
      ),
    },
    {
      title: 'Revenue Attribution',
      description: 'Track which emails drive actual revenue. See conversion paths from email open to purchase with full revenue attribution per campaign.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
  ];

  const flowSteps = [
    { step: '1', label: 'Build', detail: 'Design beautiful emails with drag-and-drop builder' },
    { step: '2', label: 'Segment', detail: 'Target specific audience groups with precision' },
    { step: '3', label: 'Personalize', detail: 'Add dynamic content based on recipient data' },
    { step: '4', label: 'Send', detail: 'Deploy campaign with optimal send time' },
    { step: '5', label: 'Track', detail: 'Monitor opens, clicks, and conversions in real-time' },
    { step: '6', label: 'Optimize', detail: 'Use insights to improve future campaigns' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600/20 via-navy-800/60 to-orange-500/20 border border-red-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5V21m0 0H4.5a2.25 2.25 0 01-2.25-2.25V7.5m0 0H21m-18 0h18m-18 0v7.5a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-7.5m0 0V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v3" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
              <p className="text-red-300/70 text-sm">AI-personalized automation</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Professional email marketing with AI-powered personalization. Build beautiful campaigns, automate drip sequences, segment audiences, and track every open and click.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-red-300 text-xs font-medium">Coming Soon — Full Attribution</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Email Campaign Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-red-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-colors">
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
        <h2 className="text-lg font-semibold text-white mb-4">Email Campaign Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-red-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-sm font-bold relative z-10">
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
          { label: '99.2% Deliverability', value: 'Industry-Leading', sub: 'Inbox guaranteed' },
          { label: 'AI-Personalized', value: 'Dynamic Content', sub: 'Every recipient unique' },
          { label: 'Unlimited Sends', value: 'No Limits', sub: 'Scale without constraints' },
          { label: 'Full Attribution', value: 'Revenue Tracking', sub: 'Know your ROI' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-sm font-semibold text-red-400">{s.value}</p>
            <p className="text-xs text-white font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
