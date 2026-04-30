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
  const [showSettings, setShowSettings] = useState(false)

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

  // English-only voice filter
  const englishVoices = voiceList.filter(v => (v.lang || '').toLowerCase().startsWith('en'))

  // Female-name hints (Mac, Windows, Chrome) - used for ranking
  const FEMALE_HINTS = ['samantha','aria','allison','ava','karen','sonia','tessa','susan','jenny','zira','helena','victoria','fiona','catherine','joanna','kate','serena','moira','google us english','google uk english female']
  const MALE_HINTS = ['daniel','alex','tom','david','guy','mark','aaron','james','mike','google uk english male','microsoft david','microsoft guy']

  // Agent gender mapping
  const AGENT_GENDER = {
    sage: 'F', mira: 'F', hazel: 'F', emma: 'F', iris: 'F', nova: 'F', vega: 'F',
    atlas: 'M', echo: 'M', onyx: 'M',
    ava: 'F', sol: 'M', lyra: 'F'
  }

  function isFemaleVoice(v) {
    const n = (v.name || '').toLowerCase()
    return FEMALE_HINTS.some(h => n.includes(h))
  }
  function isMaleVoice(v) {
    const n = (v.name || '').toLowerCase()
    return MALE_HINTS.some(h => n.includes(h))
  }

  // Pick a voice for this agent
  useEffect(() => {
    if (!ea || englishVoices.length === 0) return

    // 1) localStorage override (if user has manually picked one for this agent)
    const stored = (() => {
      try { return window.localStorage?.getItem(`liftori.voice.${ea.slug}`) } catch { return null }
    })()
    if (stored) {
      const found = englishVoices.find(v => v.name === stored)
      if (found) { setChosenVoice(found); return }
    }

    // 2) Agent-configured voice_name (DB)
    if (ea.voice_name) {
      const found = englishVoices.find(v => v.name === ea.voice_name)
                || englishVoices.find(v => v.name.toLowerCase().includes(ea.voice_name.toLowerCase()))
      if (found) { setChosenVoice(found); return }
    }

    // 3) Per-agent gender-bias preference
    const wantGender = AGENT_GENDER[ea.slug] || 'F'
    const genderMatches = englishVoices.filter(v =>
      wantGender === 'F' ? isFemaleVoice(v) : isMaleVoice(v)
    )
    if (genderMatches.length > 0) {
      // Prefer en-US over en-GB for default
      const usMatch = genderMatches.find(v => (v.lang || '').toLowerCase() === 'en-us')
      setChosenVoice(usMatch || genderMatches[0])
      return
    }

    // 4) Fallback to ANY English voice (never non-English)
    const usFallback = englishVoices.find(v => (v.lang || '').toLowerCase() === 'en-us')
    setChosenVoice(usFallback || englishVoices[0])
  }, [ea, voiceList])

  function setVoiceManually(v) {
    if (!ea) return
    setChosenVoice(v)
    try { window.localStorage?.setItem(`liftori.voice.${ea.slug}`, v.name) } catch {}
  }

  function previewVoice(v) {
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(`Hi, I'm ${ea?.name || 'your agent'}. This is what I sound like.`)
      u.voice = v
      u.rate = 1.05
      window.speechSynthesis.speak(u)
    } catch {}
  }

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

  async function startRecording() {
    if (!ea) { setError('No EA configured for your user.'); return }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mic API not available in this browser.')
      return
    }
    setError(null); setTranscript(''); setReply(''); setOpen(true); setState('recording')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' })
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
      mr.onstop = async () => {
        // Stop all tracks to release the mic
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: mr.mimeType })
        if (blob.size < 200) { setError('No audio captured. Try again.'); setState('idle'); return }
        await transcribeAndInvoke(blob)
      }
      mr.start()
      recognitionRef.current = mr
    } catch (e) {
      console.warn('[VoiceAssistant] getUserMedia error:', e)
      setError(e?.name === 'NotAllowedError' ? 'Mic permission denied. Allow mic access in browser settings.' : `Mic error: ${e?.message || e}`)
      setState('idle')
    }
  }

  function stopRecording() {
    try { recognitionRef.current?.stop() } catch {}
  }

  async function transcribeAndInvoke(audioBlob) {
    setState('thinking'); setTranscript('(transcribing...)'); setReply('')
    try {
      const fd = new FormData()
      fd.append('file', audioBlob, 'audio.webm')
      const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: fd })
      if (error) throw error
      if (data?.error) throw new Error(data.error + (data.detail ? ': ' + JSON.stringify(data.detail).slice(0, 200) : ''))
      const text = (data?.text || '').trim()
      if (!text) { setError('No speech detected in recording. Try again.'); setState('idle'); setTranscript(''); return }
      setTranscript(text)
      await invoke(text)
    } catch (e) {
      setError(`Transcription failed: ${e.message || String(e)}`)
      setState('idle')
      setTranscript('')
    }
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

          <div className="px-3 py-2 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
            <button onClick={() => setShowSettings(!showSettings)} className="text-slate-500 hover:text-slate-200" title="Voice settings">
              {showSettings ? 'hide voice settings' : 'voice settings'}
            </button>
            {state === 'speaking' && (
              <button onClick={() => { window.speechSynthesis.cancel(); setState('idle') }} className="text-rose-400 hover:text-rose-300 ml-auto">stop</button>
            )}
            {error && state === 'idle' && (
              <button onClick={startRecording} className="text-brand-blue hover:text-white ml-auto">retry</button>
            )}
          </div>
          {showSettings && (
          <div className="px-3 py-2 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
            <span className="text-slate-500">Voice:</span>
            <select
              value={chosenVoice?.name || ''}
              onChange={(e) => {
                const v = englishVoices.find(x => x.name === e.target.value)
                if (v) setVoiceManually(v)
              }}
              style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
              className="border rounded px-2 py-1 text-[11px] flex-1 min-w-0"
            >
              {englishVoices.length === 0 && <option>No English voices found</option>}
              {englishVoices.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} {v.lang ? `(${v.lang})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => chosenVoice && previewVoice(chosenVoice)}
              disabled={!chosenVoice}
              className="text-brand-blue hover:text-white disabled:opacity-50"
              title="Preview voice"
            >preview</button>
          </div>
          )}
        </div>
      )}
    </>
  )
}
