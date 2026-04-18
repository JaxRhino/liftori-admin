import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  RotateCw,
  Copy,
  ExternalLink,
  Check,
  AlertTriangle,
  Cpu,
  Radio,
  Package,
  GitBranch,
  Clock,
  Info,
} from 'lucide-react'

/**
 * Mobile Preview (Wave 11, desktop)
 *
 * Two-pane ops utility for the Liftori mobile app. Left: a phone-shaped
 * iframe that loads the Expo Web export so we can smoke-test mobile screens
 * from the desktop without a phone or an Android emulator on hand. Right:
 * an OTA ops panel that surfaces the EAS project config, channel layout, and
 * deep-links into the Expo dashboard + GitHub Actions workflows.
 *
 * The iframe URL is configurable via `VITE_MOBILE_PREVIEW_URL`. Typical
 * values:
 *   - `http://localhost:8081`               (Expo web dev server)
 *   - `https://mobile.liftori.ai`           (future: web export deploy)
 *
 * When the URL isn't set we render a friendly empty state with copy-ready
 * commands so whoever's on shift can spin one up without reading docs.
 */

// ═══════════════════════════════════════════════════════════════════════
// Static config — mirrors src/SKILL.md in liftori-mobile
// ═══════════════════════════════════════════════════════════════════════

const EAS_PROJECT_ID = 'b6c52b3d-9864-4839-b480-49cb95d5e354'
const EXPO_ACCOUNT = 'rhinomarch'
const EXPO_SLUG = 'liftori-mobile'
const GITHUB_ORG = 'JaxRhino'
const GITHUB_REPO = 'liftori-mobile'
const APP_VERSION = '0.1.0'
const RUNTIME_POLICY = 'appVersion'
const IOS_BUNDLE = 'ai.liftori.mobile'
const ANDROID_PACKAGE = 'ai.liftori.mobile'

const CHANNELS = [
  {
    key: 'preview',
    label: 'Preview',
    description: 'Sideloaded testers — Ryan + Mike + crew',
    tint: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  },
  {
    key: 'production',
    label: 'Production',
    description: 'Live customers — Play/App Store builds',
    tint: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    key: 'development',
    label: 'Development',
    description: 'Dev client w/ Metro bundler',
    tint: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
]

const DEVICES = [
  {
    key: 'iphone14',
    label: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    icon: Smartphone,
    hasNotch: true,
  },
  {
    key: 'iphoneSE',
    label: 'iPhone SE',
    width: 375,
    height: 667,
    icon: Smartphone,
    hasNotch: false,
  },
  {
    key: 'pixel7',
    label: 'Pixel 7',
    width: 412,
    height: 915,
    icon: Smartphone,
    hasNotch: false,
  },
  {
    key: 'ipadMini',
    label: 'iPad mini',
    width: 744,
    height: 1133,
    icon: Tablet,
    hasNotch: false,
  },
  {
    key: 'desktop',
    label: 'Desktop (responsive)',
    width: 1024,
    height: 768,
    icon: Monitor,
    hasNotch: false,
  },
]

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

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

function CopyChip({ value, label, copy, copied }) {
  const active = copied === label
  return (
    <button
      onClick={() => copy(value, label)}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
      }`}
      title={active ? 'Copied!' : 'Copy to clipboard'}
    >
      {active ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span className="font-mono">{value}</span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function MobilePreview() {
  const configuredUrl = import.meta.env.VITE_MOBILE_PREVIEW_URL || ''
  const [url, setUrl] = useState(configuredUrl)
  const [deviceKey, setDeviceKey] = useState('iphone14')
  const [orientation, setOrientation] = useState('portrait')
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [urlInput, setUrlInput] = useState(configuredUrl)
  const iframeRef = useRef(null)
  const { copied, copy } = useCopy()

  const device = useMemo(
    () => DEVICES.find((d) => d.key === deviceKey) ?? DEVICES[0],
    [deviceKey],
  )

  const [frameWidth, frameHeight] = useMemo(() => {
    if (orientation === 'landscape' && deviceKey !== 'desktop') {
      return [device.height, device.width]
    }
    return [device.width, device.height]
  }, [device, deviceKey, orientation])

  // Scale down the phone frame if it's taller than the viewport so it stays
  // visible without scrolling. This is a cosmetic scale — the iframe's
  // internal viewport stays at the device's real dimensions so media queries
  // still match a real phone.
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const recomputeScale = () => {
      const available = Math.max(420, window.innerHeight - 280)
      const padding = deviceKey === 'desktop' ? 80 : 140 // bezel + chrome
      const targetHeight = available - padding
      const raw = targetHeight / frameHeight
      setScale(Math.min(1, Math.max(0.45, raw)))
    }
    recomputeScale()
    window.addEventListener('resize', recomputeScale)
    return () => window.removeEventListener('resize', recomputeScale)
  }, [frameHeight, deviceKey])

  const handleReload = () => {
    setIframeLoaded(false)
    setIframeKey((k) => k + 1)
  }

  const handleApplyUrl = (e) => {
    e.preventDefault()
    const clean = urlInput.trim()
    setUrl(clean)
    setIframeLoaded(false)
    setIframeKey((k) => k + 1)
  }

  const dashboardUrl = `https://expo.dev/accounts/${EXPO_ACCOUNT}/projects/${EXPO_SLUG}`
  const updatesUrl = `${dashboardUrl}/updates`
  const buildsUrl = `${dashboardUrl}/builds`
  const actionsUrl = `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/actions`
  const updateWorkflowUrl = `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/actions/workflows/eas-update.yml`
  const buildWorkflowUrl = `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/actions/workflows/eas-build.yml`

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Mobile Preview</h1>
          <p className="mt-1 text-sm text-gray-400">
            Phone-framed iframe of the Liftori Mobile app + OTA ops panel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-navy-700"
          >
            <RefreshCw className="h-4 w-4" /> Reload iframe
          </button>
          <button
            onClick={() => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
            disabled={deviceKey === 'desktop'}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCw className="h-4 w-4" />
            {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
          </button>
        </div>
      </div>

      {/* URL bar */}
      <form
        onSubmit={handleApplyUrl}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800/50 p-2"
      >
        <span className="px-2 text-xs uppercase tracking-wider text-gray-500">
          Preview URL
        </span>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="http://localhost:8081"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-blue px-3 py-1 text-xs font-semibold text-white hover:bg-brand-blue/90"
        >
          Load
        </button>
        {url ? (
          <button
            type="button"
            onClick={() => copy(url, 'preview-url')}
            className="rounded-md border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10"
            title="Copy preview URL"
          >
            {copied === 'preview-url' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </form>

      {/* Main two-pane */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {/* Preview pane */}
        <div className="rounded-xl border border-white/10 bg-navy-900/40 p-6">
          {/* Device switcher */}
          <div className="mb-4 flex flex-wrap gap-2">
            {DEVICES.map((d) => {
              const active = d.key === deviceKey
              const Icon = d.icon
              return (
                <button
                  key={d.key}
                  onClick={() => {
                    setDeviceKey(d.key)
                    if (d.key === 'desktop') setOrientation('portrait')
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue'
                      : 'border-white/10 bg-navy-800/70 text-gray-300 hover:bg-navy-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {d.label}
                </button>
              )
            })}
          </div>

          {/* Phone bezel / iframe container */}
          <div className="flex items-start justify-center py-4">
            {url ? (
              <PhoneFrame
                width={frameWidth}
                height={frameHeight}
                scale={scale}
                hasNotch={device.hasNotch && orientation === 'portrait'}
                isDesktop={deviceKey === 'desktop'}
              >
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  src={url}
                  title="Mobile preview"
                  onLoad={() => setIframeLoaded(true)}
                  className="block h-full w-full border-0 bg-black"
                />
                {!iframeLoaded ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
                    <span className="text-xs font-medium text-gray-400">
                      Loading…
                    </span>
                  </div>
                ) : null}
              </PhoneFrame>
            ) : (
              <EmptyState />
            )}
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            {device.label} · {frameWidth}×{frameHeight}px
            {scale < 1 ? ` · ${Math.round(scale * 100)}% scale` : ''}
          </p>
        </div>

        {/* Ops panel */}
        <aside className="space-y-4">
          <OpsCard
            icon={<Cpu className="h-4 w-4 text-brand-blue" />}
            title="EAS Project"
          >
            <InfoRow label="Slug" value={EXPO_SLUG} mono copy={copy} copied={copied} copyKey="slug" />
            <InfoRow
              label="Project ID"
              value={EAS_PROJECT_ID}
              mono
              copy={copy}
              copied={copied}
              copyKey="projectId"
            />
            <InfoRow label="App version" value={APP_VERSION} mono />
            <InfoRow label="Runtime policy" value={RUNTIME_POLICY} />
            <InfoRow label="iOS bundle" value={IOS_BUNDLE} mono />
            <InfoRow label="Android package" value={ANDROID_PACKAGE} mono />
          </OpsCard>

          <OpsCard
            icon={<Radio className="h-4 w-4 text-emerald-400" />}
            title="OTA Channels"
          >
            <div className="space-y-2">
              {CHANNELS.map((c) => (
                <div
                  key={c.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-navy-800/60 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.tint}`}
                      >
                        {c.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{c.description}</p>
                  </div>
                  <CopyChip
                    value={c.key}
                    label={`channel-${c.key}`}
                    copy={copy}
                    copied={copied}
                  />
                </div>
              ))}
            </div>
          </OpsCard>

          <OpsCard
            icon={<Package className="h-4 w-4 text-purple-400" />}
            title="Deep links"
          >
            <LinkRow icon={<ExternalLink className="h-3.5 w-3.5" />} href={dashboardUrl} label="Expo project dashboard" />
            <LinkRow icon={<Clock className="h-3.5 w-3.5" />} href={updatesUrl} label="OTA update history" />
            <LinkRow icon={<Package className="h-3.5 w-3.5" />} href={buildsUrl} label="EAS build history" />
            <LinkRow icon={<GitBranch className="h-3.5 w-3.5" />} href={actionsUrl} label="GitHub Actions (all runs)" />
            <LinkRow icon={<Radio className="h-3.5 w-3.5" />} href={updateWorkflowUrl} label="Run eas-update workflow" />
            <LinkRow icon={<Cpu className="h-3.5 w-3.5" />} href={buildWorkflowUrl} label="Run eas-build workflow" />
          </OpsCard>

          <OpsCard
            icon={<Info className="h-4 w-4 text-sky-400" />}
            title="Shipping rules"
          >
            <p className="text-xs leading-relaxed text-gray-300">
              <span className="font-semibold text-white">OTA by default.</span>{' '}
              Every push to <span className="font-mono text-brand-blue">main</span>{' '}
              fires <span className="font-mono">eas-update</span> — installed APKs
              grab the new JS bundle in ~30s and apply it on next cold start.
            </p>
            <p className="text-xs leading-relaxed text-gray-300">
              <span className="font-semibold text-white">Native rebuild</span>{' '}
              (~15 min) is manual-only. Required when bumping{' '}
              <span className="font-mono">version</span>, adding a permission, or
              installing a native plugin. Skip OTAs with{' '}
              <span className="font-mono">[skip update]</span> in the commit.
            </p>
          </OpsCard>
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Pieces
// ═══════════════════════════════════════════════════════════════════════

function PhoneFrame({ width, height, scale, hasNotch, isDesktop, children }) {
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const bezel = isDesktop ? 8 : 14
  const radius = isDesktop ? 12 : 40

  return (
    <div
      style={{
        width: scaledWidth + bezel * 2,
        height: scaledHeight + bezel * 2,
      }}
      className="relative"
    >
      <div
        style={{
          width: width + bezel * 2,
          height: height + bezel * 2,
          padding: bezel,
          borderRadius: radius,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="relative bg-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/10"
      >
        <div
          style={{
            width,
            height,
            borderRadius: isDesktop ? 8 : 32,
          }}
          className="relative overflow-hidden bg-black"
        >
          {hasNotch ? (
            <div className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-black ring-1 ring-slate-800" />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-white/10 bg-navy-800/40 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
      <h3 className="mt-3 text-base font-semibold text-white">
        No preview URL configured
      </h3>
      <p className="mt-2 text-sm text-gray-400">
        Paste a URL into the bar above, or set{' '}
        <code className="rounded bg-navy-900 px-1.5 py-0.5 text-xs text-brand-blue">
          VITE_MOBILE_PREVIEW_URL
        </code>{' '}
        in Vercel and redeploy.
      </p>
      <div className="mt-4 rounded-lg bg-navy-900 p-3 text-left">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">
          Fastest option: Expo web dev
        </p>
        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-emerald-300">
          cd liftori-mobile && npx expo start --web
        </pre>
        <p className="mt-2 text-[11px] text-gray-400">
          Then load{' '}
          <span className="font-mono text-white">http://localhost:8081</span>{' '}
          above.
        </p>
      </div>
    </div>
  )
}

function OpsCard({ icon, title, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-navy-900/60 p-4">
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          {title}
        </h3>
      </header>
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
        <button
          onClick={() => copy(value, copyKey)}
          className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
            mono ? 'font-mono' : ''
          } ${active ? 'text-emerald-400' : 'text-white hover:text-brand-blue'}`}
          title={active ? 'Copied!' : 'Copy'}
        >
          {active ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span className="max-w-[220px] truncate">{value}</span>
        </button>
      ) : (
        <span className={`text-xs text-white ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  )
}

function LinkRow({ icon, href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-navy-800/40 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-navy-700/60 hover:text-white"
    >
      <span className="flex items-center gap-2">
        <span className="text-brand-blue">{icon}</span>
        {label}
      </span>
      <ExternalLink className="h-3 w-3 text-gray-500" />
    </a>
  )
}
