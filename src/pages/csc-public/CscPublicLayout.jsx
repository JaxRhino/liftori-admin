import { Outlet } from 'react-router-dom'

export default function CscPublicLayout({ subtitle }) {
  return (
    <div className="min-h-screen bg-navy-950 text-white" style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #0f1626 50%, #0a0e1a 100%)' }}>
      <header className="border-b border-orange-500/20 bg-black/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-orange-300/80 font-semibold">Served by</div>
              <div className="text-lg font-heading text-white leading-tight">CSC Services Hood &amp; Duct</div>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-white/40">NFPA 96 / ANSI-IKECA C10</div>
            <div className="text-white/30 mt-0.5">Compliance Portal</div>
          </div>
        </div>
        {subtitle && (
          <div className="max-w-5xl mx-auto px-6 pb-3 text-xs text-white/50">{subtitle}</div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 text-[11px] text-white/30 text-center border-t border-white/5">
        Compliance documentation powered by Liftori · LABOS-KEC
      </footer>
    </div>
  )
}
