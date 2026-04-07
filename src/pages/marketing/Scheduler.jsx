export default function Scheduler() {
  const capabilities = [
    {
      title: 'Multi-Platform Scheduling',
      description: 'Schedule posts to Instagram, Facebook, LinkedIn, Twitter, TikTok, Pinterest, and YouTube from one interface. Bulk upload and queue management.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      title: 'AI Optimal Timing',
      description: 'AI analyzes your audience engagement patterns and recommends the best posting times for each platform. Maximize reach with zero guesswork.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v8.25m0-8.25l-4.5 4.5M12 8.25l4.5 4.5M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
      ),
    },
    {
      title: 'Content Queue',
      description: 'Evergreen content queue that auto-recycles top-performing posts. Set it and forget it — your social feeds stay active even when you\'re busy.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.66V6.75a9 9 0 015.25-2.763m0 9.005a9 9 0 01-5.25 2.763m0 0H3.75a2.25 2.25 0 01-2.25-2.25V15m15 0H21V9.75c0-1.135-.845-2.098-1.976-2.192a48.56 48.56 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.66V15" />
        </svg>
      ),
    },
    {
      title: 'Visual Calendar',
      description: 'Drag-and-drop calendar view of all scheduled posts. See gaps in coverage, balance content types, and maintain posting consistency.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      title: 'Hashtag Manager',
      description: 'AI-generated hashtag recommendations based on content, industry, and trending topics. Save hashtag sets for quick reuse across posts.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75h18M3 12h18m-9 6h9M3 18h12" />
        </svg>
      ),
    },
    {
      title: 'Engagement Hub',
      description: 'Monitor and respond to comments, DMs, and mentions across all platforms in one inbox. Never miss a customer interaction.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21H12a9 9 0 009-9v-5.25c0-.564-.46-1.02-1.02-1.02h-5.217c-.712 0-1.39.29-1.872.76a3.73 3.73 0 01-2.906 1.211c-1.034 0-2.027-.22-2.919-.646-.897-.426-1.742-1.08-2.404-1.961C5.597 10.75 4.5 9.922 3.75 8.236M2.25 12.76V3.75A2.25 2.25 0 014.5 1.5h8.759c.576 0 1.059.55 1.059 1.2v5.218c0 .712.492 1.329 1.231 1.327.769 0 1.512-.42 1.513-1.327V3.75a2.25 2.25 0 012.25-2.25H21a2.25 2.25 0 012.25 2.25v18.75A2.25 2.25 0 0121 24h-9.243a.75.75 0 00-.715.55" />
        </svg>
      ),
    },
    {
      title: 'Team Collaboration',
      description: 'Assign posts to team members for review. Built-in approval workflows with comments and edit suggestions before anything goes live.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      title: 'Post Analytics',
      description: 'Track engagement, reach, clicks, and follower growth per post. See what content types and topics drive the most engagement.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
  ];

  const flowSteps = [
    { step: '1', label: 'Create', detail: 'Write, design, or import social media content' },
    { step: '2', label: 'Schedule', detail: 'Set posting times or let AI recommend optimal times' },
    { step: '3', label: 'Publish', detail: 'Posts go live automatically across all platforms' },
    { step: '4', label: 'Engage', detail: 'Monitor comments and interactions in real-time' },
    { step: '5', label: 'Analyze', detail: 'Track performance and optimize for future posts' },
    { step: '6', label: 'Optimize', detail: 'Auto-recycle top performers and refine strategy' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600/20 via-navy-800/60 to-blue-500/20 border border-indigo-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 015.25 21h13.5A2.25 2.25 0 0121 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Social Scheduler</h1>
              <p className="text-indigo-300/70 text-sm">Multi-platform automation</p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Schedule, automate, and optimize your social media presence across every platform. AI-powered posting times, content queues, and engagement tracking.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-indigo-300 text-xs font-medium">Coming Soon — 7 Platforms</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Scheduler Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="group relative rounded-xl bg-navy-800/50 border border-navy-700/50 p-5 hover:border-indigo-500/30 transition-all duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
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
        <h2 className="text-lg font-semibold text-white mb-4">Publishing Lifecycle</h2>
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-6">
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-indigo-500/20" />
            <div className="space-y-4">
              {flowSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold relative z-10">
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
          { label: '7 Platforms', value: 'All Major Networks', sub: 'One unified scheduler' },
          { label: 'Smart Timing', value: 'AI-Powered', sub: 'Maximize reach always' },
          { label: 'Auto-Queue', value: 'Set & Forget', sub: 'Content runs 24/7' },
          { label: '360° Engagement', value: 'Real-Time', sub: 'Monitor all interactions' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 text-center">
            <p className="text-sm font-semibold text-indigo-400">{s.value}</p>
            <p className="text-xs text-white font-medium mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
