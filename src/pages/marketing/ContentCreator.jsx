export default function ContentCreator() {
  const capabilities = [
    {
      title: 'AI Content Generator',
      description: 'Generate blog posts, social captions, ad copy, and email content with AI. Feed it your brand voice, target audience, and goals — it does the rest.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.537-.855-1.607-1.605-2.998-1.605-2.212 0-4.001 1.912-4.001 4.272v8.756a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0020.25 15.332V9.516c0-2.36-1.789-4.272-4.001-4.272-1.391 0-2.46.75-2.998 1.604M15 20.25H7.5a2.25 2.25 0 01-2.25-2.25M15 5.75c.099-.435.234-.842.404-1.225" />
        </svg>
      ),
    },
    {
      title: 'Brand Voice Engine',
      description: 'Train the AI on your brand\'s tone, vocabulary, and style. Every piece of content matches your voice whether it\'s formal B2B or casual social.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m0 0a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'Content Calendar',
      description: 'Visual calendar showing all planned content across channels. Drag to reschedule, see gaps, and ensure consistent posting cadence.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0121 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      title: 'Template Library',
      description: 'Pre-built templates for every content type — blog outlines, social posts, email sequences, case studies, press releases. Customize and publish.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0013.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      title: 'SEO Content Optimizer',
      description: 'AI analyzes your content for SEO best practices. Keyword density, readability score, meta descriptions, and internal linking suggestions.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      title: 'Multi-Platform Formatter',
      description: 'Write once, publish everywhere. Auto-formats content for Instagram, LinkedIn, Twitter, Facebook, TikTok, and blog with platform-specific best practices.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.135a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
      ),
    },
    {
      title: 'Collaboration & Approval',
      description: 'Team collaboration with comments, @mentions, and version tracking. Built-in approval workflow ensures nothing publishes without sign-off.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Performance Insights',
      description: 'See which content performs best by type, topic, channel, and time. AI recommends what to create next based on what\'s already working.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
  ];

  const flowSteps = [
    { step: '1', label: 'Ideate', detail: 'Brainstorm content topics and themes' },
    { step: '2', label: 'Draft', detail: 'AI generates initial content or team writes' },
    { step: '3', label: 'Review', detail: 'Team provides feedback and suggestions' },
    { step: '4', label: 'Optimize', detail: 'SEO tune and format for platforms' },
    { step: '5', label: 'Publish', detail: 'Auto-deploy to all channels' },
    { step: '6', label: 'Analyze', detail: 'Track performance and learn for next time' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-600/20 via-navy-800/60 to-rose-600/20 border border-pink-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.537-.855-1.607-1.605-2.998-1.605-2.212 0-4.001 1.912-4.001 4.272v8.756a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0020.25 15.332V9.516c0-2.36-1.789-4.272-4.001-4.272-1.391 0-2.46.75-2.998 1.604M15 20.25H7.5a2.25 2.25 0 01-2.25-2.25M15 5.75c.099-.435.234-.842.404-1.225" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Content Creator</h1>
              <p className="text-pink-300/70 text-sm">AI-powered content studio</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            AI-powered content creation studio. Generate blog posts, social captions, ad copy, email sequences, and more — all on-brand and optimized for every platform.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <span className="text-pink-300 text-xs font-medium">Coming Soon — Content at Scale</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Creator Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-pink-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500/20 transition-colors">
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

      {/* Content Lifecycle */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Content Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-pink-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 text-sm font-bold relative z-10">
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
          { label: 'Speed Improvement', value: '10x', sub: 'Faster content creation' },
          { label: 'Brand Consistency', value: '100%', sub: 'On-brand always' },
          { label: 'Supported Platforms', value: '8', sub: 'All major channels' },
          { label: 'Power', value: 'AI-Powered', sub: 'Next-gen creation' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-pink-400 font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
