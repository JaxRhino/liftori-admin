import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useCrm } from '../../contexts/CrmContext'
import { HubPage, Section, EmptyState } from './_shared'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { toast } from 'sonner'
import {
  GraduationCap, BookOpen, PlayCircle, FileText, LinkIcon, CheckCircle2, Circle,
  ChevronLeft, Plus, Pencil, Trash2, Sparkles, Lock, Clock, Upload, X, Building2,
} from 'lucide-react'

// =====================================================================
// Sales Training — "Liftori University" (base CRM, Sales hub)
// - Standard Liftori-provided curriculum (is_standard) + company-uploaded
//   courses/lessons (files in `training-materials` bucket, or external links)
// - Per-rep completion tracking via training_progress (keyed by member email)
// - AI training is a higher-plan upsell (locked card here)
// Tables: training_courses / training_lessons / training_progress
// =====================================================================

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced']
const CONTENT_TYPES = [
  { key: 'article', label: 'Article / Text' },
  { key: 'video', label: 'Video' },
  { key: 'document', label: 'Document (PDF)' },
  { key: 'link', label: 'External link' },
]
const LEVEL_COLOR = { beginner: '#22c55e', intermediate: '#0ea5e9', advanced: '#a855f7', all: '#94a3b8' }

function typeIcon(t, cls = 'w-4 h-4') {
  if (t === 'video') return <PlayCircle className={cls} />
  if (t === 'document') return <FileText className={cls} />
  if (t === 'link') return <LinkIcon className={cls} />
  return <BookOpen className={cls} />
}

function toEmbed(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); return v ? `https://www.youtube.com/embed/${v}` : url }
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (u.hostname.includes('vimeo.com')) { const id = u.pathname.split('/').filter(Boolean).pop(); return `https://player.vimeo.com/video/${id}` }
    if (u.hostname.includes('loom.com')) return url.replace('/share/', '/embed/')
    return url
  } catch (e) { return url }
}

const fieldCls = 'w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue'
const labelCls = 'block text-xs font-medium text-gray-400 mb-1'

function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className="h-full bg-brand-blue rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-gray-500 mt-1">{done}/{total} lessons{pct === 100 && total ? ' · complete' : ''}</p>
    </div>
  )
}

export default function CrmSalesTraining() {
  const { client, platform, tier } = useCrm()
  const { track: trackParam } = useParams()
  const TRACK_DEFS = {
    sales: { title: 'Sales Training', subtitle: "Liftori University sales curriculum plus your company's own training - track each rep's progress.", proPlus: false },
    operations: { title: 'Operations Training', subtitle: "Field execution, safety, quality and closeout - Liftori University plus your company's own training.", proPlus: false },
    manager: { title: 'Manager Training', subtitle: 'KPIs, coaching, scheduling and great meetings - train managers to run the business by the numbers.', proPlus: false },
    owner: { title: 'Owner / Business Growth', subtitle: 'Business training for owners - financials, pricing, hiring, marketing and scaling with systems.', proPlus: true },
  }
  const track = TRACK_DEFS[trackParam] ? trackParam : 'sales'
  const trackDef = TRACK_DEFS[track]
  const ownerLocked = trackDef.proPlus && tier !== 'pro' && tier !== 'scale'
  const [courses, setCourses] = useState([])
  const [lessons, setLessons] = useState([])
  const [members, setMembers] = useState([])
  const [doneSet, setDoneSet] = useState(new Set())
  const [member, setMember] = useState(null) // {email,name}
  const [loading, setLoading] = useState(true)
  const [openCourse, setOpenCourse] = useState(null)
  const [courseModal, setCourseModal] = useState(null) // course object or {} for new
  const [lessonModal, setLessonModal] = useState(null) // {course, lesson}
  const [viewer, setViewer] = useState(null) // lesson

  const lsKey = `crm_training_member_${platform?.id || 'x'}`

  useEffect(() => { if (client) loadBase() /* eslint-disable-next-line */ }, [client, track])
  useEffect(() => { if (client && member) loadProgress() /* eslint-disable-next-line */ }, [client, member])

  async function loadBase() {
    try {
      setLoading(true)
      const safe = (p) => p.then(r => r.data || []).catch(() => [])
      const [cs, ls, ms] = await Promise.all([
        safe(client.from('training_courses').select('*').eq('track', track).order('is_standard', { ascending: false }).order('sort_order')),
        safe(client.from('training_lessons').select('*').order('sort_order')),
        safe(client.from('org_team_members').select('first_name,last_name,email,role').order('first_name')),
      ])
      setCourses(cs); setLessons(ls); setMembers(ms)
      const stored = (() => { try { return localStorage.getItem(lsKey) } catch (e) { return null } })()
      const pick = ms.find(m => m.email === stored) || ms[0]
      if (pick) setMember({ email: pick.email, name: [pick.first_name, pick.last_name].filter(Boolean).join(' ') })
    } catch (e) { console.error(e); toast.error('Failed to load training') }
    finally { setLoading(false) }
  }

  async function loadProgress() {
    const { data } = await client.from('training_progress').select('lesson_id').eq('member_email', member.email)
    setDoneSet(new Set((data || []).map(r => r.lesson_id)))
  }

  function pickMember(email) {
    const m = members.find(x => x.email === email)
    if (!m) return
    setMember({ email: m.email, name: [m.first_name, m.last_name].filter(Boolean).join(' ') })
    try { localStorage.setItem(lsKey, email) } catch (e) {}
  }

  const lessonsByCourse = useMemo(() => {
    const map = {}
    for (const l of lessons) (map[l.course_id] = map[l.course_id] || []).push(l)
    return map
  }, [lessons])

  const standard = courses.filter(c => c.is_standard)
  const company = courses.filter(c => !c.is_standard)
  const courseProgress = (c) => {
    const ls = lessonsByCourse[c.id] || []
    return { done: ls.filter(l => doneSet.has(l.id)).length, total: ls.length }
  }

  async function toggleDone(lesson) {
    if (!member) { toast.error('Pick who is viewing first'); return }
    const isDone = doneSet.has(lesson.id)
    const next = new Set(doneSet)
    try {
      if (isDone) {
        next.delete(lesson.id); setDoneSet(next)
        await client.from('training_progress').delete().eq('lesson_id', lesson.id).eq('member_email', member.email)
      } else {
        next.add(lesson.id); setDoneSet(next)
        await client.from('training_progress').upsert(
          { lesson_id: lesson.id, course_id: lesson.course_id, member_email: member.email, member_name: member.name, status: 'completed', completed_at: new Date().toISOString() },
          { onConflict: 'lesson_id,member_email' })
      }
    } catch (e) { console.error(e); toast.error('Could not save progress'); loadProgress() }
  }

  async function deleteCourse(c) {
    if (!window.confirm(`Delete "${c.title}" and its lessons?`)) return
    await client.from('training_courses').delete().eq('id', c.id)
    toast.success('Course deleted'); setOpenCourse(null); loadBase()
  }
  async function deleteLesson(l) {
    if (!window.confirm('Delete this lesson?')) return
    if (l.storage_path) { try { await client.storage.from('training-materials').remove([l.storage_path]) } catch (e) {} }
    await client.from('training_lessons').delete().eq('id', l.id)
    toast.success('Lesson deleted'); loadBase()
  }

  if (loading) return <HubPage title="Sales Training"><div className="text-gray-400 text-sm">Loading…</div></HubPage>

  // ---------- COURSE DETAIL ----------
  if (openCourse) {
    const c = courses.find(x => x.id === openCourse.id) || openCourse
    const ls = (lessonsByCourse[c.id] || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const { done, total } = courseProgress(c)
    return (
      <HubPage
        title={c.title}
        subtitle={c.description}
        actions={<Button variant="outline" onClick={() => setOpenCourse(null)}><ChevronLeft className="w-4 h-4 mr-1" />Library</Button>}
      >
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {c.is_standard
            ? <Badge style={{ backgroundColor: '#0ea5e933', color: '#7dd3fc', borderColor: '#0ea5e955' }}><GraduationCap className="w-3 h-3 mr-1" />Liftori University</Badge>
            : <Badge style={{ backgroundColor: '#1e293b', color: '#cbd5e1', borderColor: '#334155' }}><Building2 className="w-3 h-3 mr-1" />Company Training</Badge>}
          {c.category && <Badge variant="outline">{c.category}</Badge>}
          {c.level && c.level !== 'all' && <Badge style={{ backgroundColor: LEVEL_COLOR[c.level] + '22', color: LEVEL_COLOR[c.level], borderColor: LEVEL_COLOR[c.level] + '55' }}>{c.level}</Badge>}
          {!c.is_standard && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCourseModal(c)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
              <Button size="sm" variant="outline" onClick={() => deleteCourse(c)}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
            </div>
          )}
        </div>
        <div className="max-w-md mb-5"><ProgressBar done={done} total={total} /></div>

        <Section title={`Lessons (${ls.length})`} right={!c.is_standard && <Button size="sm" onClick={() => setLessonModal({ course: c, lesson: null })}><Plus className="w-3.5 h-3.5 mr-1" />Add Lesson</Button>}>
          {ls.length === 0
            ? <div className="p-6"><EmptyState title="No lessons yet" description="Add your first lesson — an article, a video link, or an uploaded file." cta={!c.is_standard && <Button size="sm" onClick={() => setLessonModal({ course: c, lesson: null })}><Plus className="w-3.5 h-3.5 mr-1" />Add Lesson</Button>} /></div>
            : <ul className="divide-y divide-navy-700/50">
              {ls.map((l, i) => {
                const isDone = doneSet.has(l.id)
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-navy-700/20">
                    <button onClick={() => toggleDone(l)} title={isDone ? 'Mark not done' : 'Mark complete'} className="shrink-0">
                      {isDone ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5 text-gray-600 hover:text-gray-400" />}
                    </button>
                    <button onClick={() => setViewer(l)} className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-5">{i + 1}.</span>
                        <span className="text-brand-blue/90">{typeIcon(l.content_type)}</span>
                        <span className={`font-medium truncate ${isDone ? 'text-gray-400' : 'text-white'}`}>{l.title}</span>
                      </div>
                      {l.description && <p className="text-xs text-gray-500 mt-0.5 ml-7 truncate">{l.description}</p>}
                    </button>
                    {l.duration_min ? <span className="text-[11px] text-gray-500 flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" />{l.duration_min}m</span> : null}
                    {!c.is_standard && (
                      <span className="flex gap-1 shrink-0">
                        <button onClick={() => setLessonModal({ course: c, lesson: l })} className="p-1 text-gray-500 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteLesson(l)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>}
        </Section>

        {viewer && <LessonViewer client={client} lesson={viewer} isDone={doneSet.has(viewer.id)} onToggle={() => toggleDone(viewer)} onClose={() => setViewer(null)} />}
        {lessonModal && <LessonModal client={client} course={lessonModal.course} lesson={lessonModal.lesson} onClose={() => setLessonModal(null)} onSaved={() => { setLessonModal(null); loadBase() }} />}
        {courseModal && <CourseModal client={client} course={courseModal} onClose={() => setCourseModal(null)} onSaved={() => { setCourseModal(null); loadBase() }} />}
      </HubPage>
    )
  }

  // ---------- LIBRARY ----------
  const memberSelect = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Viewing as</span>
      <select value={member?.email || ''} onChange={e => pickMember(e.target.value)} className="bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white">
        {members.length === 0 && <option value="">No team members</option>}
        {members.map(m => <option key={m.email} value={m.email}>{[m.first_name, m.last_name].filter(Boolean).join(' ')}{m.role ? ` · ${m.role}` : ''}</option>)}
      </select>
    </div>
  )

  if (ownerLocked) return (
    <HubPage title={trackDef.title} subtitle={trackDef.subtitle}>
      <div className="rounded-xl border border-brand-blue/30 bg-gradient-to-r from-brand-blue/10 to-transparent p-8 text-center">
        <Lock className="w-8 h-8 text-brand-blue mx-auto mb-3" />
        <h2 className="text-white font-semibold text-lg mb-2">Owner / Business Growth is a Pro feature</h2>
        <p className="text-gray-400 text-sm max-w-xl mx-auto">Unlock the full owner curriculum - financial fundamentals, pricing for profit, lead generation, hiring, leadership and scaling with systems - by upgrading to Pro or Scale.</p>
        <p className="text-brand-blue text-xs mt-3 uppercase tracking-wide">Available on Pro &amp; Scale</p>
      </div>
    </HubPage>
  )

  return (
    <HubPage title={trackDef.title} subtitle={trackDef.subtitle} actions={memberSelect}>
      <AiTrainingCard tier={tier} />

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-brand-blue" />
          <h2 className="text-white font-semibold">Liftori University <span className="text-gray-500 font-normal text-sm">· standard curriculum</span></h2>
        </div>
        {standard.length === 0
          ? <EmptyState title="No standard courses yet" description="Liftori's standard sales curriculum will appear here." />
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {standard.map(c => <CourseCard key={c.id} course={c} progress={courseProgress(c)} onOpen={() => setOpenCourse(c)} />)}
          </div>}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h2 className="text-white font-semibold">Company Training <span className="text-gray-500 font-normal text-sm">· your own material</span></h2>
          <Button size="sm" className="ml-auto" onClick={() => setCourseModal({})}><Plus className="w-3.5 h-3.5 mr-1" />Add Course</Button>
        </div>
        {company.length === 0
          ? <EmptyState title="No company courses yet" description="Upload your own onboarding, product, and sales-process training — articles, videos, or PDFs." cta={<Button size="sm" onClick={() => setCourseModal({})}><Plus className="w-3.5 h-3.5 mr-1" />Add Course</Button>} />
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {company.map(c => <CourseCard key={c.id} course={c} progress={courseProgress(c)} onOpen={() => setOpenCourse(c)} />)}
          </div>}
      </div>

      {courseModal && <CourseModal client={client} course={courseModal} onClose={() => setCourseModal(null)} onSaved={() => { setCourseModal(null); loadBase() }} />}
    </HubPage>
  )
}

function CourseCard({ course, progress, onOpen }) {
  return (
    <button onClick={onOpen} className="text-left bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-brand-blue/50 transition-colors flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg bg-brand-blue/15 flex items-center justify-center text-brand-blue">
          {course.is_standard ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
        </div>
        {course.level && course.level !== 'all' && <Badge style={{ backgroundColor: LEVEL_COLOR[course.level] + '22', color: LEVEL_COLOR[course.level], borderColor: LEVEL_COLOR[course.level] + '55' }}>{course.level}</Badge>}
      </div>
      <h3 className="text-white font-semibold leading-snug mb-1">{course.title}</h3>
      {course.description && <p className="text-xs text-gray-400 line-clamp-2 mb-3 flex-1">{course.description}</p>}
      {course.category && <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{course.category}</p>}
      <ProgressBar done={progress.done} total={progress.total} />
    </button>
  )
}

function AiTrainingCard({ tier }) {
  const unlocked = tier === 'pro' || tier === 'scale'
  return (
    <div className="mb-6 rounded-xl border border-brand-blue/30 bg-gradient-to-r from-brand-blue/10 to-transparent p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-brand-blue/20 flex items-center justify-center text-brand-blue shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold flex items-center gap-2">AI Sales Coach {!unlocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}</p>
        <p className="text-sm text-gray-400">Personalized role-play, live call feedback, and adaptive coaching for every rep.</p>
      </div>
      <Badge className="shrink-0" style={unlocked
        ? { backgroundColor: '#22c55e22', color: '#22c55e', borderColor: '#22c55e55' }
        : { backgroundColor: '#1e293b', color: '#94a3b8', borderColor: '#334155' }}>
        {unlocked ? 'Coming soon' : 'Pro & Scale'}
      </Badge>
    </div>
  )
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-700 sticky top-0 bg-navy-800">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700 flex justify-end gap-2 sticky bottom-0 bg-navy-800">{footer}</div>}
      </div>
    </div>
  )
}

function CourseModal({ client, course, onClose, onSaved }) {
  const editing = !!course?.id
  const [f, setF] = useState({
    title: course?.title || '', description: course?.description || '',
    category: course?.category || '', level: course?.level || 'all',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  async function save() {
    if (!f.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = { ...f, track: 'sales', is_standard: false, updated_at: new Date().toISOString() }
      if (editing) {
        const { error } = await client.from('training_courses').update(payload).eq('id', course.id); if (error) throw error
      } else {
        const { error } = await client.from('training_courses').insert({ ...payload, created_by: 'admin' }); if (error) throw error
      }
      toast.success(editing ? 'Course updated' : 'Course created'); onSaved()
    } catch (e) { console.error(e); toast.error('Could not save course') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={editing ? 'Edit Course' : 'New Course'} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Course'}</Button></>}>
      <div><label className={labelCls}>Title</label><input className={fieldCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Our Sales Playbook" /></div>
      <div><label className={labelCls}>Description</label><textarea className={fieldCls} rows={2} value={f.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Category</label><input className={fieldCls} value={f.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Onboarding" /></div>
        <div><label className={labelCls}>Level</label><select className={fieldCls} value={f.level} onChange={e => set('level', e.target.value)}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
      </div>
    </Modal>
  )
}

function LessonModal({ client, course, lesson, onClose, onSaved }) {
  const editing = !!lesson?.id
  const [f, setF] = useState({
    title: lesson?.title || '', description: lesson?.description || '',
    content_type: lesson?.content_type || 'article', content_url: lesson?.content_url || '',
    body: lesson?.body || '', duration_min: lesson?.duration_min || '', sort_order: lesson?.sort_order || 0,
    storage_path: lesson?.storage_path || '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const needsFileOrUrl = f.content_type === 'video' || f.content_type === 'document'

  async function save() {
    if (!f.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      let storage_path = f.storage_path
      if (file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
        const path = `${course.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await client.storage.from('training-materials').upload(path, file, { upsert: false, contentType: file.type || undefined })
        if (upErr) throw upErr
        storage_path = path
      }
      const payload = {
        course_id: course.id, title: f.title, description: f.description,
        content_type: f.content_type, content_url: f.content_url || null,
        body: f.body || null, storage_path: storage_path || null,
        duration_min: f.duration_min ? parseInt(f.duration_min, 10) : null,
        sort_order: parseInt(f.sort_order, 10) || 0,
      }
      if (editing) {
        const { error } = await client.from('training_lessons').update(payload).eq('id', lesson.id); if (error) throw error
      } else {
        const { error } = await client.from('training_lessons').insert(payload); if (error) throw error
      }
      toast.success(editing ? 'Lesson updated' : 'Lesson added'); onSaved()
    } catch (e) { console.error(e); toast.error('Could not save lesson') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={editing ? 'Edit Lesson' : 'New Lesson'} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Lesson'}</Button></>}>
      <div><label className={labelCls}>Title</label><input className={fieldCls} value={f.title} onChange={e => set('title', e.target.value)} /></div>
      <div><label className={labelCls}>Short description</label><input className={fieldCls} value={f.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Type</label><select className={fieldCls} value={f.content_type} onChange={e => set('content_type', e.target.value)}>{CONTENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        <div><label className={labelCls}>Duration (min)</label><input type="number" className={fieldCls} value={f.duration_min} onChange={e => set('duration_min', e.target.value)} /></div>
      </div>
      {f.content_type === 'article' && (
        <div><label className={labelCls}>Article content</label><textarea className={fieldCls} rows={8} value={f.body} onChange={e => set('body', e.target.value)} placeholder="Write the lesson here…" /></div>
      )}
      {(f.content_type === 'link' || needsFileOrUrl) && (
        <div><label className={labelCls}>{f.content_type === 'video' ? 'Video link (YouTube / Vimeo / Loom) ' : 'Link / URL '}{needsFileOrUrl ? '(or upload below)' : ''}</label>
          <input className={fieldCls} value={f.content_url} onChange={e => set('content_url', e.target.value)} placeholder="https://" /></div>
      )}
      {needsFileOrUrl && (
        <div>
          <label className={labelCls}>Upload file {f.content_type === 'document' ? '(PDF)' : '(video)'}</label>
          <label className="flex items-center gap-2 px-3 py-2 bg-navy-900 border border-dashed border-navy-700 rounded-lg text-sm text-gray-400 cursor-pointer hover:border-brand-blue">
            <Upload className="w-4 h-4" />
            <span className="truncate">{file ? file.name : (f.storage_path ? 'Replace current file…' : 'Choose a file…')}</span>
            <input type="file" className="hidden" accept={f.content_type === 'document' ? '.pdf,application/pdf' : 'video/*'} onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      )}
    </Modal>
  )
}

function LessonViewer({ client, lesson, isDone, onToggle, onClose }) {
  const [signedUrl, setSignedUrl] = useState(null)
  useEffect(() => {
    let live = true
    if (lesson.storage_path) {
      client.storage.from('training-materials').createSignedUrl(lesson.storage_path, 3600)
        .then(({ data }) => { if (live) setSignedUrl(data?.signedUrl || null) }).catch(() => {})
    }
    return () => { live = false }
  }, [lesson, client])

  const embed = toEmbed(lesson.content_url)
  const mediaUrl = signedUrl || lesson.content_url

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-700 sticky top-0 bg-navy-800">
          <div className="flex items-center gap-2 min-w-0"><span className="text-brand-blue">{typeIcon(lesson.content_type, 'w-5 h-5')}</span><h3 className="text-white font-semibold truncate">{lesson.title}</h3></div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          {lesson.description && <p className="text-sm text-gray-400 mb-4">{lesson.description}</p>}

          {lesson.content_type === 'article' && (
            <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{lesson.body || 'No content.'}</div>
          )}

          {lesson.content_type === 'video' && (
            embed && !signedUrl
              ? <div className="aspect-video w-full"><iframe src={embed} className="w-full h-full rounded-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={lesson.title} /></div>
              : mediaUrl ? <video src={mediaUrl} controls className="w-full rounded-lg max-h-[60vh]" /> : <p className="text-gray-500 text-sm">No video attached.</p>
          )}

          {lesson.content_type === 'document' && (
            mediaUrl
              ? <iframe src={mediaUrl} className="w-full h-[60vh] rounded-lg bg-white" title={lesson.title} />
              : <p className="text-gray-500 text-sm">No document attached.</p>
          )}

          {lesson.content_type === 'link' && (
            mediaUrl
              ? <a href={mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-blue hover:underline"><LinkIcon className="w-4 h-4" />Open resource</a>
              : <p className="text-gray-500 text-sm">No link set.</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-navy-700 flex justify-between items-center sticky bottom-0 bg-navy-800">
          {mediaUrl && lesson.content_type !== 'article' && lesson.content_type !== 'link' && <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-white">Open in new tab</a>}
          <Button className="ml-auto" variant={isDone ? 'outline' : 'default'} onClick={onToggle}>
            {isDone ? <><Circle className="w-4 h-4 mr-1" />Mark not done</> : <><CheckCircle2 className="w-4 h-4 mr-1" />Mark complete</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
