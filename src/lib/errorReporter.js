// errorReporter.js - global browser error telemetry -> work_queue (Meta-Audit 2026-06-12)
// Self-initializing on import. Never throws. Caps at 5 reports/session, dedups per message.
// Server side: client-error-report edge fn (open by design; payload caps + err-key dedup + rate cap).
const FN_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co/functions/v1/client-error-report';

let sent = 0;
const seen = new Set();

function report(message, stack) {
  try {
    if (sent >= 5) return;
    const key = String(message || '').slice(0, 120);
    if (!key || seen.has(key)) return;
    seen.add(key);
    sent += 1;
    const body = JSON.stringify({
      message: String(message).slice(0, 500),
      stack: String(stack || '').slice(0, 2000),
      page: location.pathname + location.search,
      ua: navigator.userAgent.slice(0, 200),
      app: 'liftori-admin',
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(FN_URL, new Blob([body], { type: 'text/plain' }));
    } else {
      fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* the reporter must never throw */
  }
}

function initErrorReporter() {
  if (window.__liftoriErrReporter) return;
  window.__liftoriErrReporter = true;
  window.addEventListener('error', (e) => {
    const msg = (e && e.error && e.error.message) || (e && e.message) || 'Unknown error';
    if (/ResizeObserver loop/i.test(msg)) return; // benign browser noise
    report(msg, e && e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    const msg = (r && (r.message || String(r))) || 'Unhandled rejection';
    if (/AbortError/i.test(msg)) return; // expected on navigation/cancel
    report(msg, r && r.stack);
  });
}

initErrorReporter();
