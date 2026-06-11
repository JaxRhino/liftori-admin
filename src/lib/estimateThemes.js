// Estimate themes — preset palettes + brand-color resolver.
// Used by the estimate builder (theme picker) and EstimateDocument (render/print).
// Pure module: returns hex values usable in inline styles so it also works in print/PDF.

export const ESTIMATE_THEME_PRESETS = {
  classic:  { label: 'Classic',  accent: '#2563eb', headerBg: '#0f172a', headerText: '#ffffff', pageBg: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
  slate:    { label: 'Slate',    accent: '#475569', headerBg: '#1e293b', headerText: '#ffffff', pageBg: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
  ocean:    { label: 'Ocean',    accent: '#0891b2', headerBg: '#083344', headerText: '#ffffff', pageBg: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#dbeafe' },
  forest:   { label: 'Forest',   accent: '#16a34a', headerBg: '#14532d', headerText: '#ffffff', pageBg: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#dcfce7' },
  charcoal: { label: 'Charcoal', accent: '#f59e0b', headerBg: '#18181b', headerText: '#ffffff', pageBg: '#ffffff', text: '#18181b', muted: '#71717a', border: '#e4e4e7' },
  amber:    { label: 'Amber',    accent: '#d97706', headerBg: '#451a03', headerText: '#ffffff', pageBg: '#fffbeb', text: '#1c1917', muted: '#78716c', border: '#fde68a' },
  brand:    { label: 'Brand (your colors)', accent: '#2563eb', headerBg: '#0f172a', headerText: '#ffffff', pageBg: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
}

export const DEFAULT_THEME_KEY = 'classic'

// Resolve a palette. When themeKey === 'brand', the tenant's org colors
// (org_settings.primary_color / accent_color) drive the accent + header.
// accentOverride (customer_estimates.accent_color) always wins last.
export function resolveTheme(themeKey, orgSettings = {}, accentOverride = null) {
  const base = ESTIMATE_THEME_PRESETS[themeKey] || ESTIMATE_THEME_PRESETS[DEFAULT_THEME_KEY]
  const theme = { ...base }
  const brandAccent = (orgSettings && (orgSettings.accent_color || orgSettings.primary_color)) || null
  if (themeKey === 'brand') {
    if (orgSettings && orgSettings.primary_color) theme.headerBg = orgSettings.primary_color
    if (brandAccent) theme.accent = brandAccent
  }
  if (accentOverride) theme.accent = accentOverride
  return theme
}

// For rendering the theme picker swatches in the builder.
export function themeOptions() {
  return Object.entries(ESTIMATE_THEME_PRESETS).map(([key, v]) => ({ key, label: v.label, accent: v.accent }))
}
