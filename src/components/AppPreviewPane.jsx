import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Smartphone, Tablet, Monitor, RefreshCw, RotateCw, Copy, ExternalLink,
  Check, AlertTriangle, Cpu, Radio, Package, GitBranch, Clock, Info, Download,
} from 'lucide-react'

/**
 * AppPreviewPane — registry-driven live phone-frame preview + ops panel for a
 * single mobile app. Embedded as the "App" tab inside ProductDetail so the App
 * Viewer lives in a product's tabs, not as a separate sidebar page.
 *
 * Props:
 *   app          — product.app config ({ previewUrl, status, note, eas, repo, channels }) or null
 *   productName  — display name used in labels / empty states
 */

const DEVICES = [
  { key: 'iphone14', label: 'iPhone 14 Pro', width: 393, height: 852, icon: Smartphone, hasNotch: true },
  { key: 'iphoneSE', label: 'iPhone SE', width: 375, height: 667, icon: Smartphone, hasNotch: false },
  { key: 'pixel7', label: 'Pixel 7', width: 412, height: 915, icon: Smartphone, hasNotch: false },
  { key: 'ipadMini', label: 'iPad mini', width: 744, height: 1133, icon: Tablet, hasNotch: false },
  { key: 'desktop', label: 'Desktop (responsive)', width: 1024, height: 768, icon: Monitor, hasNotch: false },
]

function useCopy() {
  const [copied, setCopied] = useState(null)
  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600)
    } catch {
      // clipboard may be blocked in iframes — no-op
    }
  }
  return { copied, copy }
}

export default function AppPreviewPane({ app, productName = 'App' }) {
  const initialUrl = app?.previewUrl || ''
  const [url, setUrl] = useState(initialUrl)
  const [deviceKey, setDeviceKey] = useState('iphone14')
  const [orientation, setOrientation] = useState('portrait')
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [urlInput, setUrlInput] = useState(initialUrl)
  const iframeRef = useRef(null)
  const { copied, copy } = useCopy()

  const device = useMemo(() => DEVICES.find((d) => d.key === deviceKey) ?? DEVICES[0], [deviceKey])
  const [frameWidth, frameHeight] = useMemo(() => {
    if (orientation === 'landscape' && deviceKey !== 'desktop') return [device.height, device.width]
    return [device.width, device.height]
  }, [device, deviceKey, orientation])

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const recomputeScale = () => {
      const available = Math.max(420, window.innerHeight - 280)
      const padding = deviceKey === 'desktop' ? 80 : 140
      const raw = (available - padding) / frameHeight
      setScale(Math.min(1, Math.max(0.45, raw)))
    }
    recomputeScale()
    window.addEventListener('resize', recomputeScale)
    return () => window.removeEventListener('resize', recomputeScale)
  }, [frameHeight, deviceKey])

  const handleReload = () => { setIframeLoaded(false); setIframeKey((k) => k + 1) }
  const handleApplyUrl = (e) => {
    e.preventDefault()
    setUrl(urlInput.trim())
    setIframeLoaded(false)
    setIframeKey((k) => k + 1)
  }

  const eas = app?.eas
  const repo = app?.repo
  const dashboardUrl = eas ? `https://expo.dev/accounts/${eas.account}/projects/${eas.expoSlug}` : null
  const updatesUrl = dashboardUrl ? `${dashboardUrl}/updates` : null
  const buildsUrl = dashboardUrl ? `${dashboardUrl}/builds` : null
  const repoUrl = repo ? `https://github.com/${repo.org}/${repo.name}` : null
  const actionsUrl = repo ? `${repoUrl}/actions` : null
  const updateWorkflowUrl = repo ? `${repoUrl}/actions/workflows/eas-update.yml` : null
  const buildWorkflowUrl = repo ? `${repoUrl}/actions/workflows/eas-build.yml` : null
  const sourceZipUrl = repo ? `${repoUrl}/archive/refs/heads/${repo.branch}.zip` : null

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button onClick={handleReload} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-navy-700">
          <RefreshCw className="h-4 w-4" /> Reload iframe
        </button>
        <button onClick={() => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))} disabled={deviceKey === 'desktop'}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed">
          <RotateCw className="h-4 w-4" />
          {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
        </button>
      </div>

      {/* URL bar */}
      <form onSubmit={handleApplyUrl} className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800/50 p-2">
        <span className="px-2 text-xs uppercase tracking-wider text-gray-500">Preview URL</span>
        <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="http://localhost:8081"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none" />
        <button type="submit" className="rounded-md bg-brand-blue px-3 py-1 text-xs font-semibold text-white hover:bg-brand-blue/90">Load</button>
        {url ? (
          <button type="button" onClick={() => copy(url, 'preview-url')} className="rounded-md border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10" title="Copy preview URL">
            {copied === 'preview-url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {/* Preview pane */}
        <div className="rounded-xl border border-white/10 bg-navy-900/40 p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {DEVICES.map((d) => {
              const active = d.key === deviceKey
              const Icon = d.icon
              return (
                <button key={d.key} onClick={() => { setDeviceKey(d.key); if (d.key === 'desktop') setOrientation('portrait') }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    active ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue' : 'border-white/10 bg-navy-800/70 text-gray-300 hover:bg-navy-700'
                  }`}>
                  <Icon className="h-3.5 w-3.5" />
                  {d.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-start justify-center py-4">
            {url ? (
              <PhoneFrame width={frameWidth} height={frameHeight} scale={scale} hasNotch={device.hasNotch && orientation === 'portrait'} isDesktop={deviceKey === 'desktop'}>
                <iframe key={iframeKey} ref={iframeRef} src={url} title={`${productName} preview`} onLoad={() => setIframeLoaded(true)} className="block h-full w-full border-0 bg-black" />
                {!iframeLoaded ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
                    <span className="text-xs font-medium text-gray-400">Loading…</span>
                  </div>
                ) : null}
              </PhoneFrame>
            ) : (
              <EmptyPreview app={app} productName={productName} />
            )}
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            {device.label} · {frameWidth}×{frameHeight}px{scale < 1 ? ` · ${Math.round(scale * 100)}% scale` : ''}
          </p>
        </div>

        {/* Ops panel */}
        <aside className="space-y-4">
          <OpsCard icon={<Download className="h-4 w-4 text-emerald-400" />} title="Download">
            {repo ? (
              <div className="space-y-2">
                {!repo.private && (
                  <a href={sourceZipUrl} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm text-white transition-colors hover:bg-emerald-500/10">
                    <span className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-emerald-400" />
                      <span>
                        <span className="font-medium">Download source (.zip)</span>
                        <span className="block text-[11px] text-gray-400">{repo.org}/{repo.name} · {repo.branch}</span>
                      </span>
                    </span>
                    <ExternalLink className="h-3 w-3 text-gray-500" />
                  </a>
                )}
                {buildsUrl && <LinkRow icon={<Package className="h-3.5 w-3.5" />} href={buildsUrl} label={repo.private ? 'Download latest build (APK)' : 'Download build (APK / IPA)'} />}
                <LinkRow icon={<GitBranch className="h-3.5 w-3.5" />} href={repoUrl} label="Open repo on GitHub" />
                {repo.private && <p className="text-[11px] leading-relaxed text-gray-500">Private repo — source zip unavailable. Grab the signed APK from EAS builds above.</p>}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-gray-400">No downloadable build yet — this product hasn't been provisioned with a repo or EAS project.</p>
            )}
          </OpsCard>

          {app?.note && (
            <OpsCard icon={<Info className="h-4 w-4 text-sky-400" />} title="Platforms">
              <p className="text-xs leading-relaxed text-gray-300">{app.note}</p>
            </OpsCard>
          )}

          {eas && (
            <OpsCard icon={<Cpu className="h-4 w-4 text-brand-blue" />} title="EAS Project">
              <InfoRow label="Slug" value={eas.expoSlug} mono copy={copy} copied={copied} copyKey="slug" />
              {eas.projectId ? <InfoRow label="Project ID" value={eas.projectId} mono copy={copy} copied={copied} copyKey="projectId" /> : null}
              {eas.appVersion && <InfoRow label="App version" value={eas.appVersion} mono />}
              {eas.runtimePolicy && <InfoRow label="Runtime policy" value={eas.runtimePolicy} />}
              {eas.iosBundle && <InfoRow label="iOS bundle" value={eas.iosBundle} mono />}
              {eas.androidPackage && <InfoRow label="Android package" value={eas.androidPackage} mono />}
            </OpsCard>
          )}

          {app?.channels && app.channels.length > 0 && (
            <OpsCard icon={<Radio className="h-4 w-4 text-emerald-400" />} title="OTA Channels">
              <div className="space-y-2">
                {app.channels.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-navy-800/60 p-3">
                    <div className="min-w-0">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.tint}`}>{c.label}</span>
                      <p className="mt-1 text-xs text-gray-400">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </OpsCard>
          )}

          {repo && (
            <OpsCard icon={<Package className="h-4 w-4 text-brand-blue" />} title="Deep links">
              {dashboardUrl && <LinkRow icon={<ExternalLink className="h-3.5 w-3.5" />} href={dashboardUrl} label="Expo project dashboard" />}
              {updatesUrl && <LinkRow icon={<Clock className="h-3.5 w-3.5" />} href={updatesUrl} label="OTA update history" />}
              {buildsUrl && <LinkRow icon={<Package className="h-3.5 w-3.5" />} href={buildsUrl} label="EAS build history" />}
              {actionsUrl && <LinkRow icon={<GitBranch className="h-3.5 w-3.5" />} href={actionsUrl} label="GitHub Actions (all runs)" />}
              {updateWorkflowUrl && <LinkRow icon={<Radio className="h-3.5 w-3.5" />} href={updateWorkflowUrl} label="Run eas-update workflow" />}
              {buildWorkflowUrl && <LinkRow icon={<Cpu className="h-3.5 w-3.5" />} href={buildWorkflowUrl} label="Run eas-build workflow" />}
            </OpsCard>
          )}

          {eas && (
            <OpsCard icon={<Info className="h-4 w-4 text-sky-400" />} title="Shipping rules">
              <p className="text-xs leading-relaxed text-gray-300">
                <span className="font-semibold text-white">OTA by default.</span> Every push to <span className="font-mono text-brand-blue">main</span> fires <span className="font-mono">eas-update</span> — installed APKs grab the new JS bundle in ~30s and apply it on next cold start.
              </p>
              <p className="text-xs leading-relaxed text-gray-300">
                <span className="font-semibold text-white">Native rebuild</span> (~15 min) is manual-only. Required when bumping <span className="font-mono">version</span>, adding a permission, or installing a native plugin. Skip OTAs with <span className="font-mono">[skip update]</span> in the commit.
              </p>
            </OpsCard>
          )}
        </aside>
      </div>
    </div>
  )
}

function PhoneFrame({ width, height, scale, hasNotch, isDesktop, children }) {
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const bezel = isDesktop ? 8 : 14
  const radius = isDesktop ? 12 : 40
  return (
    <div style={{ width: scaledWidth + bezel * 2, height: scaledHeight + bezel * 2 }} className="relative">
      <div style={{ width: width + bezel * 2, height: height + bezel * 2, padding: bezel, borderRadius: radius, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        className="relative bg-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/10">
        <div style={{ width, height, borderRadius: isDesktop ? 8 : 32 }} className="relative overflow-hidden bg-black">
          {hasNotch ? <div className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-black ring-1 ring-slate-800" /> : null}
          {children}
        </div>
      </div>
    </div>
  )
}

function EmptyPreview({ app, productName }) {
  const planned = !app || app.status === 'planned'
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-white/10 bg-navy-800/40 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
      <h3 className="mt-3 text-base font-semibold text-white">No preview URL loaded</h3>
      <p className="mt-2 text-sm text-gray-400">
        {planned
          ? `${productName} doesn't have a live app preview yet. Paste a dev URL above once an Expo project is running.`
          : `Paste a URL into the bar above to load the ${productName} preview.`}
      </p>
      <div className="mt-4 rounded-lg bg-navy-900 p-3 text-left">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">Fastest option: Expo web dev</p>
        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-emerald-300">{app?.repo ? `cd ${app.repo.name} && npx expo start --web` : 'npx expo start --web'}</pre>
        <p className="mt-2 text-[11px] text-gray-400">Then load <span className="font-mono text-white">http://localhost:8081</span> above.</p>
      </div>
    </div>
  )
}

function OpsCard({ icon, title, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-navy-900/60 p-4">
      <header className="mb-3 flex items-center gap-2">{icon}<h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">{title}</h3></header>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function InfoRow({ label, value, mono, copy, copied, copyKey }) {
  const isCopyable = !!copy && !!copyKey
  const active = copied === copyKey
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      {isCopyable ? (
        <button onClick={() => copy(value, copyKey)} className={`inline-flex items-center gap-1.5 text-xs transition-colors ${mono ? 'font-mono' : ''} ${active ? 'text-emerald-400' : 'text-white hover:text-brand-blue'}`} title={active ? 'Copied!' : 'Copy'}>
          {active ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span className="max-w-[220px] truncate">{value}</span>
        </button>
      ) : (
        <span className={`text-xs text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function LinkRow({ icon, href, label }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-navy-800/40 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-navy-700/60 hover:text-white">
      <span className="flex items-center gap-2"><span className="text-brand-blue">{icon}</span>{label}</span>
      <ExternalLink className="h-3 w-3 text-gray-500" />
    </a>
  )
}
