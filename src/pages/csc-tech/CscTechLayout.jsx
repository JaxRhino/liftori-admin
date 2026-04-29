import { Outlet, NavLink } from 'react-router-dom'

export default function CscTechLayout() {
  return (
    <div className="min-h-screen bg-navy-950 text-white" style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #0f1626 50%, #0a0e1a 100%)' }}>
      <header className="sticky top-0 z-30 bg-black/60 backdrop-blur border-b border-orange-500/20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/csc/tech" end className={({ isActive }) => isActive ? 'flex items-center gap-2' : 'flex items-center gap-2'}>
            <div className="w-8 h-8 rounded bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-orange-300/80 font-semibold leading-none">CSC Tech</div>
              <div className="text-sm font-heading text-white leading-tight">Field App</div>
            </div>
          </NavLink>
          <div className="text-[10px] text-white/40 text-right leading-tight">
            <div>NFPA 96</div>
            <div>v1.0 demo</div>
          </div>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-4 pb-32">
        <Outlet />
      </main>
    </div>
  )
}
