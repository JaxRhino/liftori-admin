import { useEffect, useRef, useState } from 'react'

/**
 * Own e-sign component. Two modes:
 *  - typed: user types their full name in a styled cursive font
 *  - drawn: HTML5 canvas, captured as PNG dataURL
 *
 * Returns via onChange:
 *   { method: 'typed' | 'drawn', typed: string|null, drawn: dataURL|null, isComplete: bool }
 */
export default function SignaturePad({ defaultName = '', onChange, requiredName = null }) {
  const [mode, setMode] = useState('typed')
  const [typed, setTyped] = useState(defaultName)
  const [drawn, setDrawn] = useState(null)
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const isComplete = mode === 'typed' ? typed.trim().length >= 3 : !!drawn
    onChange?.({
      method: mode,
      typed: mode === 'typed' ? typed.trim() || null : null,
      drawn: mode === 'drawn' ? drawn : null,
      isComplete,
    })
  }, [mode, typed, drawn, onChange])

  // ─── Canvas drawing ──────────────────────────────────────
  useEffect(() => {
    if (mode !== 'drawn') return
    const canvas = canvasRef.current
    if (!canvas) return
    // Setup HiDPI canvas
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'

    function getPos(e) {
      const r = canvas.getBoundingClientRect()
      const t = e.touches?.[0]
      return { x: (t?.clientX ?? e.clientX) - r.left, y: (t?.clientY ?? e.clientY) - r.top }
    }
    function start(e) {
      e.preventDefault()
      drawingRef.current = true
      lastPosRef.current = getPos(e)
    }
    function move(e) {
      if (!drawingRef.current) return
      e.preventDefault()
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPosRef.current = pos
    }
    function end() {
      if (!drawingRef.current) return
      drawingRef.current = false
      setDrawn(canvas.toDataURL('image/png'))
    }
    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [mode])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setDrawn(null)
  }

  const nameMismatch = requiredName && typed.trim() && typed.trim().toLowerCase() !== requiredName.trim().toLowerCase()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 bg-navy-800 border border-navy-700/50 rounded-lg w-fit">
        {[
          { key: 'typed', label: 'Type to sign' },
          { key: 'drawn', label: 'Draw to sign' },
        ].map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === m.key ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'typed' ? (
        <div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requiredName || 'Type your full legal name'}
            className="w-full bg-white border-2 border-navy-700/50 rounded-lg px-4 py-4 text-2xl text-slate-900 focus:outline-none focus:border-brand-blue"
            style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", "Snell Roundhand", cursive' }}
            autoComplete="off"
          />
          {nameMismatch && (
            <p className="mt-1 text-xs text-amber-400">
              Tip: signature should match the name on the invite ({requiredName}).
            </p>
          )}
          {typed.trim().length >= 3 && !nameMismatch && (
            <p className="mt-1 text-xs text-emerald-400">✓ Signature captured</p>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-white rounded-lg border-2 border-navy-700/50 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ height: '160px', touchAction: 'none', cursor: 'crosshair' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs">
            <span className={drawn ? 'text-emerald-400' : 'text-gray-500'}>
              {drawn ? '✓ Signature captured' : 'Sign above'}
            </span>
            <button type="button" onClick={clearCanvas} className="text-gray-400 hover:text-white">Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}
