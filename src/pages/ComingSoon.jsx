import { useLocation } from 'react-router-dom'

export default function ComingSoon() {
  const location = useLocation()
  const pageName = location.pathname.split('/').pop()
  const title = pageName.charAt(0).toUpperCase() + pageName.slice(1).replace(/-/g, ' ')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-2.94a1.5 1.5 0 010-2.6l5.1-2.94a1.5 1.5 0 011.16 0l5.1 2.94a1.5 1.5 0 010 2.6l-5.1 2.94a1.5 1.5 0 01-1.16 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.32 12.23l-1.22.7a1.5 1.5 0 000 2.6l5.1 2.94a1.5 1.5 0 001.16 0l5.1-2.94a1.5 1.5 0 000-2.6l-1.22-.7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2 font-heading tracking-wide">{title}</h1>
      <p className="text-white/50 max-w-md">
        This feature is currently under development and will be available soon.
      </p>
      <div className="mt-6 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/40">
        Phase 2+ Feature
      </div>
    </div>
  )
}
