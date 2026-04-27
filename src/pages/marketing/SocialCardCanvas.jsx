// SocialCardCanvas: renders a 1080x1080 branded social card for FB/IG/LinkedIn.
// Pure HTML5 Canvas — no external deps. Exposes a toBlob() method via ref so the
// parent (SocialComposer) can grab the PNG and upload to Supabase Storage.
//
// 5 templates: announcement | quote | stat | client_win | tip
//
// Usage:
//   const cardRef = useRef(null)
//   <SocialCardCanvas ref={cardRef} template="announcement" headline="..." body="..." />
//   const blob = await cardRef.current.toBlob()

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Liftori brand palette
const NAVY = '#060B18'
const BLUE = '#0EA5E9'
const SKY = '#7DD3FC'
const LIGHT = '#E0F7FF'
const WHITE = '#FFFFFF'

const SIZE = 1080

export const SOCIAL_CARD_TEMPLATES = [
  { id: 'announcement', label: 'Announcement', desc: 'General product news, big text on navy' },
  { id: 'quote',        label: 'Quote',        desc: 'Pull quote w/ attribution, light bg' },
  { id: 'stat',         label: 'Stat',         desc: 'Big number + label, growth/milestone' },
  { id: 'client_win',   label: 'Client Win',   desc: 'New launch celebration, gradient bg' },
  { id: 'tip',          label: 'Tip / How-To', desc: 'Educational, bullet-friendly layout' },
]

// ---------- Drawing helpers ----------

function fillBackground(ctx, template) {
  if (template === 'quote') {
    ctx.fillStyle = LIGHT
    ctx.fillRect(0, 0, SIZE, SIZE)
  } else if (template === 'client_win') {
    // Vertical gradient navy → blue
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE)
    grad.addColorStop(0, NAVY)
    grad.addColorStop(1, '#0B3A66')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, SIZE, SIZE)
  } else {
    ctx.fillStyle = NAVY
    ctx.fillRect(0, 0, SIZE, SIZE)
  }

  // Subtle blue accent corner triangle (top-right) for non-quote templates
  if (template !== 'quote') {
    ctx.fillStyle = BLUE
    ctx.globalAlpha = 0.18
    ctx.beginPath()
    ctx.moveTo(SIZE, 0)
    ctx.lineTo(SIZE, 220)
    ctx.lineTo(SIZE - 220, 0)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

// LIFTORI wordmark, two-tone. Returns rendered width.
function drawWordmark(ctx, x, y, fontSize, onLight = false) {
  ctx.font = `700 ${fontSize}px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.textBaseline = 'top'
  const lift = 'LIFT'
  const ori = 'ORI'
  ctx.fillStyle = onLight ? NAVY : LIGHT
  ctx.fillText(lift, x, y)
  const liftW = ctx.measureText(lift).width
  ctx.fillStyle = BLUE
  ctx.fillText(ori, x + liftW, y)
  return liftW + ctx.measureText(ori).width
}

// Word-wrap helper — returns array of lines that fit maxWidth
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines
}

// Draw text block: returns the y-position right after the last line
function drawTextBlock(ctx, text, opts) {
  const { x, y, maxWidth, fontSize, fontWeight = 700, color, lineHeight = 1.15, align = 'left', maxLines = 99 } = opts
  ctx.font = `${fontWeight} ${fontSize}px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = align
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines)
  let yPos = y
  for (const line of lines) {
    const drawX = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x
    ctx.fillText(line, drawX, yPos)
    yPos += fontSize * lineHeight
  }
  ctx.textAlign = 'left'
  return yPos
}

// ---------- Per-template render ----------

function renderAnnouncement(ctx, { headline, body }) {
  // Top: small wordmark
  drawWordmark(ctx, 80, 80, 56)

  // Big headline center
  drawTextBlock(ctx, headline || 'Big news from Liftori.', {
    x: 80, y: 320, maxWidth: 920,
    fontSize: 88, fontWeight: 700, color: WHITE,
    lineHeight: 1.05, maxLines: 5,
  })

  // Body underneath if provided
  if (body) {
    drawTextBlock(ctx, body, {
      x: 80, y: 760, maxWidth: 920,
      fontSize: 36, fontWeight: 400, color: SKY,
      lineHeight: 1.3, maxLines: 3,
    })
  }

  // Footer URL
  ctx.font = `400 28px "DM Mono", "Menlo", monospace`
  ctx.fillStyle = LIGHT
  ctx.globalAlpha = 0.65
  ctx.fillText('liftori.ai', 80, 970)
  ctx.globalAlpha = 1
}

function renderQuote(ctx, { headline, body }) {
  // Big quote mark
  ctx.font = `700 320px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = BLUE
  ctx.textBaseline = 'top'
  ctx.fillText('“', 80, 60)

  // Quote body
  drawTextBlock(ctx, headline || 'Founders deserve better than agencies.', {
    x: 80, y: 340, maxWidth: 920,
    fontSize: 64, fontWeight: 700, color: NAVY,
    lineHeight: 1.15, maxLines: 6,
  })

  // Attribution
  if (body) {
    drawTextBlock(ctx, body, {
      x: 80, y: 820, maxWidth: 920,
      fontSize: 30, fontWeight: 500, color: NAVY,
      lineHeight: 1.3, maxLines: 2,
    })
  }

  // Wordmark bottom (on light)
  drawWordmark(ctx, 80, 970, 44, true)
}

function renderStat(ctx, { headline, body }) {
  // Wordmark top-left
  drawWordmark(ctx, 80, 80, 56)

  // Extract big number from headline (first contiguous number/percent string)
  const numMatch = (headline || '').match(/[\d,.]+\s*[%xX+]?/)
  const big = numMatch ? numMatch[0].trim() : (headline || '100')
  const label = numMatch ? (headline || '').replace(numMatch[0], '').trim() : (body || 'Liftori platforms launched')

  // Huge stat
  ctx.font = `700 320px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = BLUE
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(big, SIZE / 2, 460)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // Label
  drawTextBlock(ctx, label, {
    x: 80, y: 660, maxWidth: 920,
    fontSize: 48, fontWeight: 500, color: LIGHT,
    lineHeight: 1.25, align: 'center', maxLines: 3,
  })

  // Body / context
  if (body && numMatch) {
    drawTextBlock(ctx, body, {
      x: 80, y: 880, maxWidth: 920,
      fontSize: 28, fontWeight: 400, color: SKY,
      lineHeight: 1.3, align: 'center', maxLines: 2,
    })
  }
}

function renderClientWin(ctx, { headline, body }) {
  // "NEW LAUNCH" badge top
  ctx.fillStyle = BLUE
  ctx.fillRect(80, 80, 320, 64)
  ctx.font = `700 28px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'middle'
  ctx.fillText('NEW LAUNCH', 100, 80 + 32)
  ctx.textBaseline = 'top'

  // Big headline (client name + brief)
  drawTextBlock(ctx, headline || 'A new platform just went live.', {
    x: 80, y: 240, maxWidth: 920,
    fontSize: 80, fontWeight: 700, color: WHITE,
    lineHeight: 1.1, maxLines: 5,
  })

  // Body
  if (body) {
    drawTextBlock(ctx, body, {
      x: 80, y: 740, maxWidth: 920,
      fontSize: 32, fontWeight: 400, color: SKY,
      lineHeight: 1.3, maxLines: 3,
    })
  }

  // Wordmark bottom-right
  ctx.textAlign = 'right'
  ctx.font = `700 44px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = LIGHT
  ctx.fillText('LIFT', SIZE - 80 - ctx.measureText('ORI').width, 970)
  ctx.fillStyle = BLUE
  ctx.fillText('ORI', SIZE - 80, 970)
  ctx.textAlign = 'left'
}

function renderTip(ctx, { headline, body }) {
  // "TIP" badge top
  ctx.fillStyle = SKY
  ctx.fillRect(80, 80, 160, 64)
  ctx.font = `700 28px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = NAVY
  ctx.textBaseline = 'middle'
  ctx.fillText('TIP', 100, 80 + 32)
  ctx.textBaseline = 'top'

  // Headline
  drawTextBlock(ctx, headline || 'Build the smallest version that proves the idea.', {
    x: 80, y: 240, maxWidth: 920,
    fontSize: 72, fontWeight: 700, color: WHITE,
    lineHeight: 1.1, maxLines: 5,
  })

  // Body (formatted as bullet list if it has line breaks)
  if (body) {
    const items = body.split(/\n+/).filter(Boolean).slice(0, 4)
    let yPos = 720
    for (const item of items) {
      // Bullet dot
      ctx.fillStyle = BLUE
      ctx.beginPath()
      ctx.arc(96, yPos + 18, 8, 0, Math.PI * 2)
      ctx.fill()
      // Item text
      const endY = drawTextBlock(ctx, item, {
        x: 130, y: yPos, maxWidth: 870,
        fontSize: 30, fontWeight: 400, color: LIGHT,
        lineHeight: 1.3, maxLines: 2,
      })
      yPos = endY + 12
      if (yPos > 1000) break
    }
  }

  // Wordmark bottom-right
  ctx.textAlign = 'right'
  ctx.font = `700 36px "DM Sans", "Inter", system-ui, sans-serif`
  ctx.fillStyle = LIGHT
  ctx.fillText('LIFT', SIZE - 80 - ctx.measureText('ORI').width, 990)
  ctx.fillStyle = BLUE
  ctx.fillText('ORI', SIZE - 80, 990)
  ctx.textAlign = 'left'
}

const RENDERERS = {
  announcement: renderAnnouncement,
  quote: renderQuote,
  stat: renderStat,
  client_win: renderClientWin,
  tip: renderTip,
}

// ---------- React component ----------

const SocialCardCanvas = forwardRef(function SocialCardCanvas(
  { template = 'announcement', headline = '', body = '', previewSize = 320 },
  ref,
) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    fillBackground(ctx, template)
    const renderer = RENDERERS[template] || RENDERERS.announcement
    renderer(ctx, { headline, body })
  }, [template, headline, body])

  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((resolve, reject) => {
      const canvas = canvasRef.current
      if (!canvas) return reject(new Error('Canvas not mounted'))
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('toBlob returned null'))
      }, 'image/png', 0.95)
    }),
    getDataUrl: () => canvasRef.current?.toDataURL('image/png', 0.95) || null,
  }), [])

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{
        width: previewSize,
        height: previewSize,
        borderRadius: 12,
        display: 'block',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    />
  )
})

export default SocialCardCanvas
