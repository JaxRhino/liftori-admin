import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Briefcase, Upload, CheckCircle, Loader2, ExternalLink, MapPin, BadgeDollarSign, FileText } from 'lucide-react';

/**
 * Public Job Application Page
 * Accessible at:
 *   /apply                            — generic application (position dropdown)
 *   /apply?posting=crm-remote-sales   — posting-specific application (loads the
 *                                        opening + its screening questions)
 *   /apply?position=Some%20Title      — legacy deep-link (pre-selects position)
 *   /apply?ref=REFERRAL_CODE          — attaches a hiring referral
 * No auth required — anyone can submit an application.
 */

const INPUT_CLS =
  'w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none';

// Renders a single screening question based on its declared type.
function ScreeningField({ q, value, onChange }) {
  if (q.type === 'boolean') {
    return (
      <div className="flex gap-2">
        {[['Yes', true], ['No', false]].map(([lbl, val]) => (
          <button
            type="button"
            key={lbl}
            onClick={() => onChange(val)}
            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${
              value === val
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'bg-[#0B1120] border-white/10 text-gray-300 hover:border-sky-500/50'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'multiselect') {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (opt) =>
      onChange(arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt]);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(q.options || []).map((opt) => (
          <label
            key={opt}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
              arr.includes(opt)
                ? 'bg-sky-500/10 border-sky-500/50 text-sky-200'
                : 'bg-[#0B1120] border-white/10 text-gray-300 hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={arr.includes(opt)}
              onChange={() => toggle(opt)}
              className="accent-sky-500"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={INPUT_CLS + ' resize-none'}
        placeholder={q.placeholder || ''}
      />
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLS}
      placeholder={q.placeholder || ''}
    />
  );
}

export default function Apply() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const positionParam = searchParams.get('position') || '';
  const postingSlug = searchParams.get('posting') || '';

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [referrerName, setReferrerName] = useState('');

  const [postings, setPostings] = useState([]);
  const [posting, setPosting] = useState(null); // the resolved, locked posting (if any)
  const [screening, setScreening] = useState({});

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    position: positionParam,
    linkedin_url: '',
    portfolio_url: '',
    salary_expectation: '',
    availability: '',
    cover_note: '',
  });

  // Load active job postings (for the dropdown) + resolve the posting-specific page.
  useEffect(() => {
    supabase
      .from('job_postings')
      .select('id, slug, title, employment_type, comp_model, location, product_line, summary, description, compensation_detail, screening_questions, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const list = data || [];
        setPostings(list);
        let resolved = null;
        if (postingSlug) resolved = list.find((p) => p.slug === postingSlug) || null;
        if (!resolved && positionParam) resolved = list.find((p) => p.title === positionParam) || null;
        if (resolved) {
          setPosting(resolved);
          setForm((f) => ({ ...f, position: resolved.title }));
        }
      });
  }, [postingSlug, positionParam]);

  // Resolve referral code to name
  useEffect(() => {
    if (referralCode) {
      supabase
        .from('hiring_referrals')
        .select('user_name')
        .eq('referral_code', referralCode)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_name) setReferrerName(data.user_name);
        });
    }
  }, [referralCode]);

  // Which screening questions are currently visible (honors show_if).
  const questions = posting?.screening_questions || [];
  const visibleQuestions = questions.filter((q) => {
    if (!q.show_if) return true;
    return screening[q.show_if.key] === q.show_if.equals;
  });

  function setAnswer(key, val) {
    setScreening((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.position) {
      setError('Please fill in all required fields (Name, Email, and Position).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.phone && form.phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number (at least 10 digits).');
      return;
    }
    // Validate required screening questions that are currently visible.
    for (const q of visibleQuestions) {
      if (!q.required) continue;
      const v = screening[q.key];
      const missing =
        q.type === 'boolean'
          ? v !== true && v !== false
          : q.type === 'multiselect'
          ? !Array.isArray(v) || v.length === 0
          : !v || !String(v).trim();
      if (missing) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      let resume_url = null;

      // Upload resume if provided (chat-files is private -> signed URL)
      if (resumeFile) {
        const ext = resumeFile.name.split('.').pop();
        const path = `resumes/applications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('chat-files')
          .upload(path, resumeFile);
        if (!upErr) {
          const { data: urlData } = await supabase.storage
            .from('chat-files')
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          resume_url = (urlData && urlData.signedUrl) || null;
        }
      }

      // Submit through the SECURITY DEFINER intake RPC - anon cannot write
      // applicants / interview_tokens directly under RLS.
      const { data: rpcRows, error: rpcErr } = await supabase.rpc('submit_application', {
        p_handle: referralCode || null,
        p_full_name: form.full_name,
        p_email: form.email,
        p_phone: form.phone || null,
        p_position: form.position,
        p_linkedin_url: form.linkedin_url || null,
        p_portfolio_url: form.portfolio_url || null,
        p_salary_expectation: form.salary_expectation || null,
        p_availability: form.availability || null,
        p_cover_note: form.cover_note || null,
        p_resume_url: resume_url,
        p_posting_slug: posting?.slug || postingSlug || null,
        p_screening: posting ? screening : {},
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row || !row.interview_token) throw new Error('Application could not be submitted.');

      // Send welcome email with interview scheduling link from Sage (non-blocking)
      try {
        const schedulingUrl = `${window.location.origin}/schedule-interview/${row.interview_token}`;
        const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co';
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: form.email,
            subject: `Welcome to Liftori, ${form.full_name.split(' ')[0]}! Let's schedule your interview`,
            from: 'Sage from Liftori <sage@liftori.ai>',
            html: buildWelcomeEmail(form.full_name, form.position, schedulingUrl),
          }),
        });
      } catch (emailErr) {
        console.error('Welcome email failed (non-blocking):', emailErr);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Application error:', err);
      setError('Something went wrong. Please try again or contact us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Application Submitted</h1>
          <p className="text-gray-400">
            Thanks for your interest in joining the Liftori team, {form.full_name}.
            We'll review your application and get back to you soon.
          </p>
          {referrerName && (
            <p className="text-sm text-sky-400">Referred by {referrerName}</p>
          )}
          <a href="https://liftori.ai" className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm">
            <ExternalLink className="h-4 w-4" /> Visit liftori.ai
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B18]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0B1120]">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Join Liftori</h1>
            <p className="text-sm text-gray-400">We're building the future of AI-powered business platforms</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Posting-specific header */}
        {posting && (
          <div className="mb-6 bg-[#0B1120] border border-white/10 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">{posting.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {posting.location && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                      <MapPin className="h-3 w-3 text-gray-400" /> {posting.location}
                    </span>
                  )}
                  {posting.employment_type && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                      <FileText className="h-3 w-3 text-gray-400" /> {posting.employment_type}
                    </span>
                  )}
                  {posting.comp_model && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                      <BadgeDollarSign className="h-3 w-3 text-gray-400" /> {posting.comp_model}
                    </span>
                  )}
                  {posting.product_line && (
                    <span className="inline-flex items-center text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-full px-2.5 py-1">
                      {posting.product_line}
                    </span>
                  )}
                </div>
                {posting.description && (
                  <p className="mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                    {posting.description}
                  </p>
                )}
                {posting.compensation_detail && (
                  <div className="mt-3 text-sm text-gray-300 bg-sky-500/5 border-l-2 border-sky-500/40 rounded-r-lg px-3 py-2">
                    <span className="text-sky-300 font-medium">Compensation:</span> {posting.compensation_detail}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {referrerName && (
          <div className="mb-6 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500/20 rounded-full flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm text-sky-300 font-medium">Referred by {referrerName}</p>
              <p className="text-xs text-gray-400">Your application will be prioritized</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="you@email.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Position *</label>
                {posting ? (
                  <div className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm flex items-center justify-between">
                    <span>{posting.title}</span>
                    <span className="text-xs text-gray-500">This opening</span>
                  </div>
                ) : (
                  <select
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    className={INPUT_CLS}
                    required
                  >
                    <option value="">Select a position</option>
                    {postings.map(p => (
                      <option key={p.slug} value={p.title}>{p.title}</option>
                    ))}
                    <option value="Other">Other / General Interest</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Role-specific screening questions */}
          {visibleQuestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">A Few Questions</h2>
              <div className="space-y-5">
                {visibleQuestions.map(q => (
                  <div key={q.key}>
                    <label className="text-sm text-gray-300 mb-2 block">
                      {q.label}{q.required ? ' *' : ''}
                    </label>
                    <ScreeningField q={q} value={screening[q.key]} onChange={(v) => setAnswer(q.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Professional Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Professional Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">LinkedIn Profile</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Portfolio / Website</label>
                <input
                  type="url"
                  value={form.portfolio_url}
                  onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="https://yoursite.com"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Salary / Comp Expectation</label>
                <input
                  type="text"
                  value={form.salary_expectation}
                  onChange={e => setForm(f => ({ ...f, salary_expectation: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="Commission-based, $80k base, etc."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Availability</label>
                <input
                  type="text"
                  value={form.availability}
                  onChange={e => setForm(f => ({ ...f, availability: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="Available now, 2 weeks notice..."
                />
              </div>
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Resume</h2>
            <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-sky-500/50 transition-colors">
              <Upload className="h-5 w-5 text-gray-400" />
              <div className="text-sm">
                {resumeFile ? (
                  <span className="text-sky-400">{resumeFile.name}</span>
                ) : (
                  <span className="text-gray-400">Click to upload resume (PDF, DOC, DOCX)</span>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={e => setResumeFile(e.target.files[0] || null)}
              />
            </label>
          </div>

          {/* Cover Note */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Why Liftori?</h2>
            <textarea
              value={form.cover_note}
              onChange={e => setForm(f => ({ ...f, cover_note: e.target.value }))}
              className={INPUT_CLS + ' resize-none'}
              rows={4}
              placeholder="Tell us why you'd be a great fit for the Liftori team..."
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By submitting, you agree to allow Liftori to process your application data.
            We'll never share your information with third parties.
          </p>
        </form>
      </div>
    </div>
  );
}

function buildWelcomeEmail(fullName, position, schedulingUrl) {
  const firstName = fullName.split(' ')[0];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:12px 24px;border-radius:12px;">
      <span style="color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Liftori</span>
    </div>
  </div>
  <div style="background-color:#1a2332;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:40px;margin-bottom:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:28px;">&#10024;</span>
      </div>
      <h1 style="color:white;font-size:24px;margin:0 0 4px;">Welcome, ${fullName}!</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">A message from Sage, your AI assistant at Liftori</p>
    </div>
    <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;">I am so excited to welcome you to the Liftori application process! I am Sage, the AI that helps power everything at Liftori, and I will be your guide through this journey.</p>
      <p style="margin:0 0 16px;">We received your application for <strong style="color:white;">${position}</strong> and we are genuinely thrilled about your interest. At Liftori, we are building the future of AI-powered business solutions, and every person who joins our team plays a critical role in that mission.</p>
      <p style="margin:0 0 16px;">Here is what happens next:</p>
      <div style="background-color:rgba(14,165,233,0.1);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#0ea5e9;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">1</span>
          <span style="color:#e2e8f0;"><strong style="color:white;">Schedule Your Interview</strong> — Pick a time that works for you</span>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#6366f1;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">2</span>
          <span style="color:#e2e8f0;"><strong style="color:white;">Meet the Team</strong> — Have a conversation with our leadership</span>
        </div>
        <div style="display:flex;align-items:flex-start;">
          <span style="background:#10b981;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">3</span>
          <span style="color:#e2e8f0;"><strong style="color:white;">Get Started</strong> — If approved, you will receive your platform access</span>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${schedulingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;">Schedule Your Interview</a>
    </div>
    <p style="text-align:center;color:#64748b;font-size:12px;margin:0;">This link expires in 7 days</p>
  </div>
  <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
    <p style="margin:0 0 4px;">Sent with care by Sage</p>
    <p style="margin:0 0 4px;">Liftori — AI-Powered Business Solutions</p>
    <p style="margin:0;"><a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a></p>
  </div>
</div>
</body></html>`;
}
