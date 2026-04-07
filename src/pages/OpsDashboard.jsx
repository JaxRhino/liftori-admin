export default function OpsDashboard() {
  const capabilities = [
    {
      id: 1,
      title: "Active Build Tracker",
      description: "Real-time view of all projects currently in build phase. See status, assigned dev, estimated completion, blockers, and daily progress. One screen to know exactly where every build stands.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 2,
      title: "Client Request Queue",
      description: "Incoming change requests, bug reports, and feature asks from clients. Priority-ranked, categorized, and linked to the project. Never lose track of what clients need.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    {
      id: 3,
      title: "Sprint Planner",
      description: "Plan weekly and bi-weekly dev sprints. Drag tasks from the backlog, assign capacity, set goals. Automatic velocity tracking over time.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    },
    {
      id: 4,
      title: "Deployment Pipeline",
      description: "Track every deployment from staging to production. Rollback controls, build logs, and Vercel integration. Know what shipped and when.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      )
    },
    {
      id: 5,
      title: "Team Workload",
      description: "See each dev's current assignments, capacity, and utilization. Balance work across the team, identify bottlenecks, prevent burnout.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20a9 9 0 0118 0" />
        </svg>
      )
    },
    {
      id: 6,
      title: "Quality Gate",
      description: "Pre-launch checklist enforcement. Every project must pass QA, code review, performance, accessibility, and security checks before going live.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 7,
      title: "Time Tracking & Estimates",
      description: "Log hours against projects, compare actual vs estimated, track scope creep. Feeds into client invoicing and profitability analysis.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 8,
      title: "Automation Queue",
      description: "Tasks queued for future automation. Track which manual processes are most painful and prioritize what to automate next. Build the machine that builds the machine.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5h.01" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Header */}
      <div className="relative px-6 py-12 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 via-amber-600/20 to-orange-600/20 opacity-40" />
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Ops Dashboard</h1>
              <p className="text-gray-400 text-lg">Build operations command center</p>
            </div>
          </div>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-navy-700/50 border border-amber-500/30 rounded-full">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="text-amber-400 text-sm font-medium">Coming Soon</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Build Lifecycle Flow */}
        <div className="mb-16">
          <h2 className="text-lg font-semibold text-white mb-8">Build Lifecycle</h2>
          <div className="flex items-center gap-2 lg:gap-4">
            {['Scoped', 'Assigned', 'In Build', 'QA Review', 'Deployed'].map((stage, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-brand-blue/30 to-brand-blue/10 border border-brand-blue/50 rounded-lg flex items-center justify-center text-white text-sm lg:text-base font-medium mb-2">
                    {idx + 1}
                  </div>
                  <p className="text-gray-400 text-xs lg:text-sm text-center">{stage}</p>
                </div>
                {idx < 4 && (
                  <div className="h-0.5 bg-gradient-to-r from-brand-blue/30 to-transparent flex-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          <div className="bg-navy-700/30 border border-navy-600/50 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">Active Builds</p>
            <p className="text-2xl font-bold text-white">—</p>
          </div>
          <div className="bg-navy-700/30 border border-navy-600/50 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">Open Requests</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
          <div className="bg-navy-700/30 border border-navy-600/50 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">Sprint Velocity</p>
            <p className="text-2xl font-bold text-white">—</p>
          </div>
          <div className="bg-navy-700/30 border border-navy-600/50 rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-2">Deploy Success</p>
            <p className="text-2xl font-bold text-white">—%</p>
          </div>
        </div>

        {/* Capabilities Header */}
        <h2 className="text-lg font-semibold text-white mb-8">Capabilities Coming</h2>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {capabilities.map((capability) => (
            <div
              key={capability.id}
              className="group relative bg-gradient-to-br from-navy-700/40 to-navy-800/40 border border-navy-700/50 rounded-lg p-6 hover:border-brand-blue/30 transition-colors duration-300"
            >
              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-brand-blue/5 to-transparent" />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-navy-600/50 border border-navy-500/50 rounded-lg text-brand-blue group-hover:text-blue-300 transition-colors">
                    {capability.icon}
                  </div>
                  <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    <span className="text-blue-400 text-xs font-medium">Feature</span>
                  </div>
                </div>

                <h3 className="text-white font-semibold mb-3 text-lg">
                  {capability.title}
                </h3>

                <p className="text-gray-400 text-sm leading-relaxed">
                  {capability.description}
                </p>

                {/* Bottom accent line */}
                <div className="mt-6 pt-4 border-t border-navy-600/30 group-hover:border-brand-blue/20 transition-colors">
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-brand-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    Available in beta
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="mt-16 text-center py-12 border-t border-navy-700/50">
          <p className="text-gray-400 mb-4">
            Ops Dashboard is under active development. These features will ship as part of the core platform build.
          </p>
          <p className="text-sm text-gray-500">
            Contact engineering for early access or feature prioritization.
          </p>
        </div>
      </div>
    </div>
  );
}
