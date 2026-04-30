import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * VoiceAssistant
 * Floating EA avatar in the global header (top-left near sidebar).
 * Click to talk. Browser-native STT + TTS. Per-agent voice selection.
 */
export default function VoiceAssistant() {
  const { user } = useAuth()
  const [ea, setEa] = useState(null)
  const [state, setState] = useState('idle') // idle | recording | thinking | speaking
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [voiceList, setVoiceList] = useState([])
  const [chosenVoice, setChosenVoice] = useState(null)

  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)
  const supportedRef = useRef({ stt: false, tts: false })

  // Detect support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    supportedRef.current = {
      stt: !!SR,
      tts: typeof window.speechSynthesis !== 'undefined',
    }
  }, [])

  // Load EA for this user
  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const { data: human } = await supabase
          .from('workforce_humans')
          .select('full_name, personal_ea_agent_slug, pairs_with_agent_slug')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!human) return
        const slug = human.personal_ea_agent_slug || human.pairs_with_agent_slug
        if (!slug) return
        const { data: agent } = await supabase
          .from('ai_agents')
          .select('id, name, slug, role, voice_name')
          .eq('slug', slug)
          .maybeSingle()
        if (alive && agent) setEa(agent)
      } catch (e) { console.warn('[VoiceAssistant] load EA failed:', e) }
    })()
    return () => { alive = false }
  }, [user])

  // Load TTS voices (async on some browsers)
  useEffect(() => {
    if (!supportedRef.current.tts) return
    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) setVoiceList(v)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // Pick a voice for this agent
  useEffect(() => {
    if (!ea || voiceList.length === 0) return
    // If agent has a configured voice_name, try to match it
    let picked = null
    if (ea.voice_name) {
      picked = voiceList.find(v => v.name.toLowerCase().includes(ea.voice_name.toLowerCase()))
    }
    if (!picked) {
      // Per-agent default mapping (best-effort across OSes)
      const preferences = {
        sage:  ['Samantha','Aria','Jenny','Microsoft Zira','Google US English','en-US'],
        mira:  ['Aria','Sonia','Karen','Samantha','Microsoft Aria','en-US'],
        hazel: ['Karen','Allison','Tessa','Microsoft Jenny','Google UK English Female','en-GB'],
        emma:  ['Sonia','Allison','Microsoft Sonia','Microsoft Aria','en-US'],
        atlas: ['Daniel','Microsoft Guy','Microsoft David','Google UK English Male','en-GB'],
        nova:  ['Tessa','Microsoft Aria','en-US'],
        vega:  ['Karen','Microsoft Zira','en-US'],
        echo:  ['Daniel','Microsoft Guy','en-US'],
        onyx:  ['Daniel','Microsoft David','en-US'],
        iris:  ['Allison','Microsoft Sonia','en-US'],
      }
      const wants = preferences[ea.slug] || ['en-US']
      for (const w of wants) {
        picked = voiceList.find(v => v.name === w) || voiceList.find(v => v.name.toLowerCase().includes(w.toLowerCase()))
        if (picked) break
      }
    }
    if (!picked) picked = voiceList.find(v => v.lang?.startsWith('en')) || voiceList[0]
    setChosenVoice(picked)
  }, [ea, voiceList])

  function speak(text) {
    if (!supportedRef.current.tts || !text) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      if (chosenVoice) u.voice = chosenVoice
      u.rate = 1.05
      u.pitch = 1
      u.volume = 1
      u.onstart = () => setState('speaking')
      u.onend = () => setState('idle')
      u.onerror = () => setState('idle')
      utteranceRef.current = u
      window.speechSynthesis.speak(u)
    } catch (e) { console.warn('[VoiceAssistant] tts error:', e) }
  }

  function startRecording() {
    if (!supportedRef.current.stt) {
      setError('Speech recognition not supported in this browser. Use Chrome or Edge.')
      return
    }
    if (!ea) { setError('No EA configured for your user.'); return }
    setError(null); setTranscript(''); setReply(''); setOpen(true); setState('recording')

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += txt
        else interim += txt
      }
      setTranscript(finalText + interim)
    }
    rec.onerror = (e) => {
      console.warn('[VoiceAssistant] stt error:', e.error)
      setError(`Mic error: ${e.error}`)
      setState('idle')
    }
    rec.onend = async () => {
      const text = finalText.trim()
      if (!text) { setState('idle'); return }
      await invoke(text)
    }
    rec.start()
    recognitionRef.current = rec
  }

  function stopRecording() {
    try { recognitionRef.current?.stop() } catch {}
  }

  async function invoke(text) {
    setState('thinking'); setReply('')
    try {
      const { data, error } = await supabase.functions.invoke('invoke-agent', {
        body: { agent_id: ea.id, task: text }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const responseText = data.response || ''
      setReply(responseText)
      speak(responseText)
    } catch (e) {
      setError(e.message || String(e))
      setState('idle')
    }
  }

  function handleClick() {
    if (state === 'recording') stopRecording()
    else if (state === 'speaking') { window.speechSynthesis.cancel(); setState('idle') }
    else startRecording()
  }

  function close() {
    if (state === 'recording') stopRecording()
    if (state === 'speaking') window.speechSynthesis.cancel()
    setOpen(false); setState('idle'); setTranscript(''); setReply(''); setError(null)
  }

  if (!ea) return null
  if (!supportedRef.current.stt && !supportedRef.current.tts) return null

  const ringClass =
    state === 'recording' ? 'ring-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
    : state === 'thinking' ? 'ring-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
    : state === 'speaking' ? 'ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse'
    : 'ring-purple-500/40 hover:ring-brand-blue/60'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleClick}
        title={state === 'idle' ? `Talk to ${ea.name}` : state}
        className={`fixed top-3 left-[72px] z-[60] w-11 h-11 rounded-full bg-gradient-to-br from-purple-700/40 to-navy-800 flex items-center justify-center text-purple-200 font-bold text-base overflow-hidden ring-2 transition-all ${ringClass}`}
      >
        <img
          src={`/team/${ea.slug}.jpg`}
          alt={ea.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <span className="absolute">{ea.name[0]}</span>
        {state === 'recording' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-navy-950" />
        )}
        {state === 'thinking' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-navy-950 animate-pulse" />
        )}
        {state === 'speaking' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-navy-950" />
        )}
      </button>

      {/* Caption / transcript bubble */}
      {open && (
        <div className="fixed top-16 left-3 z-[60] w-[380px] bg-navy-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-brand-blue/10 to-transparent">
            <div className="text-xs">
              <span className="font-semibold text-white">{ea.name}</span>
              <span className="text-slate-500 ml-2">{state === 'recording' ? 'listening...' : state === 'thinking' ? 'thinking...' : state === 'speaking' ? 'speaking...' : 'ready'}</span>
            </div>
            <button onClick={close} className="text-slate-500 hover:text-slate-200 text-sm leading-none px-2">x</button>
          </div>

          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-800/40 rounded p-2">{error}</div>
            )}
            {transcript && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">You said</div>
                <div className="text-sm text-slate-200 italic">{transcript}</div>
              </div>
            )}
            {reply && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">{ea.name}</div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{reply}</div>
              </div>
            )}
            {!transcript && !reply && !error && state === 'idle' && (
              <div className="text-xs text-slate-500 italic text-center py-2">
                Click the avatar to talk to {ea.name}.
                <br />Browser-native voice. Chrome / Edge recommended.
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>{chosenVoice ? `Voice: ${chosenVoice.name}` : 'Voice loading...'}</span>
            {state === 'speaking' && (
              <button onClick={() => { window.speechSynthesis.cancel(); setState('idle') }} className="text-rose-400 hover:text-rose-300">stop</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
