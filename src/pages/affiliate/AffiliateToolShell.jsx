/**
 * Reusable "coming soon" shell for creator tools under development.
 * Shows what the tool will do + what's in scope for each tier + CTA buttons for what's already usable.
 */
export default function AffiliateToolShell({ icon, title, tagline, description, features, tierBreakdown, comingSoon = true, previewAction, children }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="text-5xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {tagline && <p className="text-base text-gray-400 mt-1">{tagline}</p>}
        </div>
        {comingSoon && (
          <span className="text-[10px] uppercase font-bold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Coming Soon
          </span>
        )}
      </div>

      {description && (
        <p className="text-gray-300 leading-relaxed max-w-3xl">{description}</p>
      )}

      {features && features.length > 0 && (
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5">
          <div className="text-xs uppercase font-bold text-gray-500 mb-3">What this tool will do</div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-300">
            {features.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-pink-400 flex-shrink-0">●</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tierBreakdown && (
        <div className="grid md:grid-cols-3 gap-3">
          {tierBreakdown.map((tier) => (
            <div
              key={tier.tier}
              className={`rounded-xl p-4 border ${
                tier.tier === 'Starter' ? 'bg-slate-500/5 border-slate-500/20' :
                tier.tier === 'Creator' ? 'bg-sky-500/5 border-sky-500/20' :
                'bg-emerald-500/5 border-emerald-500/20'
              }`}
            >
              <div className="text-xs uppercase font-bold text-gray-400">{tier.tier}</div>
              <div className="text-sm text-white mt-1 font-semibold">{tier.headline}</div>
              <ul className="mt-2 space-y-1 text-xs text-gray-400">
                {tier.items.map((item, i) => <li key={i}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {previewAction && (
        <div className="flex justify-center pt-2">
          {previewAction}
        </div>
      )}

      {children}
    </div>
  )
}
