import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Building2, Users2, Globe, Target, Plus, X, Save, Edit2, Trash2,
  MapPin, Link as LinkIcon,
} from 'lucide-react';
import {
  COMPANY_SIZE_BUCKETS,
  REVENUE_BUCKETS,
  WEBSITE_KINDS,
  fetchIndustries,
  addIndustry,
  updateEngagement,
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  fetchOrgMembers,
  createOrgMember,
  updateOrgMember,
  deleteOrgMember,
  buildOrgTree,
  fetchWebsites,
  createWebsite,
  updateWebsite,
  deleteWebsite,
} from '../../lib/consultingOnboardingService';

// ─────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────
const fieldCls = 'w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600';
const optCls = 'bg-slate-800 text-white';
const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition';
const btnGhost = 'inline-flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-300 rounded-lg text-sm font-medium transition';
const btnDanger = 'inline-flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md text-xs transition';

function Field({ label, hint, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, action, children }) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-5 mb-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center">
              <Icon className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Company Tab
// ─────────────────────────────────────────────────────────────────────
export function CompanyTab({ engagement, onUpdate }) {
  const [form, setForm] = useState({
    industry: engagement.industry || '',
    company_size_bucket: engagement.company_size_bucket || '',
    employee_count: engagement.employee_count || '',
    annual_revenue_bucket: engagement.annual_revenue_bucket || '',
    years_in_business: engagement.years_in_business || '',
    founded_date: engagement.founded_date || '',
    headquarters_address: engagement.headquarters_address || '',
    offerings: engagement.offerings || '',
    target_customer: engagement.target_customer || '',
    pain_points: engagement.pain_points || '',
    goals_12mo: engagement.goals_12mo || '',
    goals_3yr: engagement.goals_3yr || '',
    marketing_strategy: engagement.marketing_strategy || '',
  });
  const [industries, setIndustries] = useState([]);
  const [newIndustry, setNewIndustry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchIndustries().then(setIndustries).catch(() => {}); }, []);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      const patch = {
        ...form,
        employee_count: form.employee_count === '' ? null : parseInt(form.employee_count),
        years_in_business: form.years_in_business === '' ? null : parseInt(form.years_in_business),
        founded_date: form.founded_date || null,
      };
      await updateEngagement(engagement.id, patch);
      toast.success('Company details saved');
      onUpdate?.();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddIndustry() {
    const trimmed = newIndustry.trim();
    if (!trimmed) return;
    try {
      await addIndustry(trimmed);
      const list = await fetchIndustries();
      setIndustries(list);
      setF('industry', trimmed);
      setNewIndustry('');
      toast.success('Industry added');
    } catch (e) {
      toast.error(e.message || 'Could not add industry');
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard icon={Building2} title="Company Profile" subtitle="Who they are and where they stand">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Industry">
            <div className="flex gap-2">
              <select value={form.industry} onChange={e => setF('industry', e.target.value)} className={fieldCls}>
                <option value="" className={optCls}>— Select —</option>
                {industries.map(i => (
                  <option key={i.id} value={i.name} className={optCls}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newIndustry}
                onChange={e => setNewIndustry(e.target.value)}
                placeholder="Add industry…"
                className={fieldCls}
              />
              <button type="button" onClick={handleAddIndustry} className={btnGhost}>
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </Field>

          <Field label="Company Size">
            <select value={form.company_size_bucket} onChange={e => setF('company_size_bucket', e.target.value)} className={fieldCls}>
              <option value="" className={optCls}>— Select —</option>
              {COMPANY_SIZE_BUCKETS.map(b => (
                <option key={b.value} value={b.value} className={optCls}>{b.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Employee Count">
            <input type="number" min="0" value={form.employee_count} onChange={e => setF('employee_count', e.target.value)} className={fieldCls} placeholder="Exact count" />
          </Field>

          <Field label="Annual Revenue">
            <select value={form.annual_revenue_bucket} onChange={e => setF('annual_revenue_bucket', e.target.value)} className={fieldCls}>
              <option value="" className={optCls}>— Select —</option>
              {REVENUE_BUCKETS.map(b => (
                <option key={b.value} value={b.value} className={optCls}>{b.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Years in Business">
            <input type="number" min="0" value={form.years_in_business} onChange={e => setF('years_in_business', e.target.value)} className={fieldCls} />
          </Field>

          <Field label="Founded Date">
            <input type="date" value={form.founded_date} onChange={e => setF('founded_date', e.target.value)} className={fieldCls} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Headquarters Address">
              <textarea rows={2} value={form.headquarters_address} onChange={e => setF('headquarters_address', e.target.value)} className={fieldCls} placeholder="Street, city, state, zip" />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Target} title="Offering & Market" subtitle="What they sell and who they serve">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Offerings">
            <textarea rows={3} value={form.offerings} onChange={e => setF('offerings', e.target.value)} className={fieldCls} placeholder="Products / services they sell" />
          </Field>
          <Field label="Target Customer">
            <textarea rows={3} value={form.target_customer} onChange={e => setF('target_customer', e.target.value)} className={fieldCls} placeholder="Who their ideal buyer is" />
          </Field>
          <Field label="Pain Points">
            <textarea rows={3} value={form.pain_points} onChange={e => setF('pain_points', e.target.value)} className={fieldCls} placeholder="What's keeping them up at night" />
          </Field>
          <Field label="Marketing Strategy">
            <textarea rows={3} value={form.marketing_strategy} onChange={e => setF('marketing_strategy', e.target.value)} className={fieldCls} placeholder="How they currently go to market" />
          </Field>
          <Field label="12-Month Goals">
            <textarea rows={3} value={form.goals_12mo} onChange={e => setF('goals_12mo', e.target.value)} className={fieldCls} />
          </Field>
          <Field label="3-Year Goals">
            <textarea rows={3} value={form.goals_3yr} onChange={e => setF('goals_3yr', e.target.value)} className={fieldCls} />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Org Chart Tab
// ─────────────────────────────────────────────────────────────────────
export function OrgChartTab({ engagement }) {
  const [depts, setDepts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', head_count: '' });
  const [memberForm, setMemberForm] = useState({
    full_name: '', title: '', email: '', phone: '',
    department_id: '', reports_to_id: '', seat_roles: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        fetchDepartments(engagement.id),
        fetchOrgMembers(engagement.id),
      ]);
      setDepts(d);
      setMembers(m);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [engagement.id]);

  useEffect(() => { reload(); }, [reload]);

  async function saveDept() {
    if (!deptForm.name.trim()) return toast.error('Department name required');
    try {
      await createDepartment(engagement.id, {
        name: deptForm.name.trim(),
        head_count: deptForm.head_count === '' ? null : parseInt(deptForm.head_count),
      });
      setDeptForm({ name: '', head_count: '' });
      setShowDeptForm(false);
      toast.success('Department added');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  async function removeDept(id) {
    if (!confirm('Delete this department? Members will remain but be unassigned.')) return;
    try { await deleteDepartment(id); reload(); }
    catch (e) { toast.error(e.message); }
  }

  async function saveMember() {
    if (!memberForm.full_name.trim()) return toast.error('Name required');
    const payload = {
      full_name: memberForm.full_name.trim(),
      title: memberForm.title || null,
      email: memberForm.email || null,
      phone: memberForm.phone || null,
      department_id: memberForm.department_id || null,
      reports_to_id: memberForm.reports_to_id || null,
      seat_roles: memberForm.seat_roles
        ? memberForm.seat_roles.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    };
    try {
      if (editMember) {
        await updateOrgMember(editMember.id, payload);
        toast.success('Member updated');
      } else {
        await createOrgMember(engagement.id, payload);
        toast.success('Member added');
      }
      setMemberForm({ full_name: '', title: '', email: '', phone: '', department_id: '', reports_to_id: '', seat_roles: '' });
      setEditMember(null);
      setShowMemberForm(false);
      reload();
    } catch (e) { toast.error(e.message); }
  }

  function startEdit(m) {
    setEditMember(m);
    setMemberForm({
      full_name: m.full_name || '',
      title: m.title || '',
      email: m.email || '',
      phone: m.phone || '',
      department_id: m.department_id || '',
      reports_to_id: m.reports_to_id || '',
      seat_roles: (m.seat_roles || []).join(', '),
    });
    setShowMemberForm(true);
  }

  async function removeMember(id) {
    if (!confirm('Delete this team member?')) return;
    try { await deleteOrgMember(id); reload(); }
    catch (e) { toast.error(e.message); }
  }

  const tree = buildOrgTree(members);

  if (loading) return <div className="text-center text-slate-500 py-12">Loading org chart…</div>;

  return (
    <div className="space-y-5">
      <SectionCard
        icon={Building2}
        title="Departments"
        subtitle="How the org is structured"
        action={
          <button onClick={() => setShowDeptForm(v => !v)} className={btnGhost}>
            <Plus className="w-3.5 h-3.5" /> Add department
          </button>
        }
      >
        {showDeptForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 bg-slate-800/40 rounded-lg">
            <input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="Department name" className={fieldCls} />
            <input type="number" value={deptForm.head_count} onChange={e => setDeptForm(p => ({ ...p, head_count: e.target.value }))} placeholder="Head count" className={fieldCls} />
            <button onClick={saveDept} className={btnPrimary}><Save className="w-3.5 h-3.5" /> Save</button>
          </div>
        )}
        {depts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No departments yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {depts.map(d => {
              const count = members.filter(m => m.department_id === d.id).length;
              return (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
                  <div>
                    <p className="font-semibold text-white text-sm">{d.name}</p>
                    <p className="text-xs text-slate-500">{count} member{count === 1 ? '' : 's'}{d.head_count ? ` · ${d.head_count} planned` : ''}</p>
                  </div>
                  <button onClick={() => removeDept(d.id)} className={btnDanger}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={Users2}
        title="Leadership & Team"
        subtitle="Who sits in which seat"
        action={
          <button onClick={() => { setEditMember(null); setMemberForm({ full_name: '', title: '', email: '', phone: '', department_id: '', reports_to_id: '', seat_roles: '' }); setShowMemberForm(v => !v); }} className={btnGhost}>
            <Plus className="w-3.5 h-3.5" /> Add person
          </button>
        }
      >
        {showMemberForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-slate-800/40 rounded-lg">
            <input value={memberForm.full_name} onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Full name" className={fieldCls} />
            <input value={memberForm.title} onChange={e => setMemberForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" className={fieldCls} />
            <input value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className={fieldCls} />
            <input value={memberForm.phone} onChange={e => setMemberForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={fieldCls} />
            <select value={memberForm.department_id} onChange={e => setMemberForm(p => ({ ...p, department_id: e.target.value }))} className={fieldCls}>
              <option value="" className={optCls}>— Department —</option>
              {depts.map(d => <option key={d.id} value={d.id} className={optCls}>{d.name}</option>)}
            </select>
            <select value={memberForm.reports_to_id} onChange={e => setMemberForm(p => ({ ...p, reports_to_id: e.target.value }))} className={fieldCls}>
              <option value="" className={optCls}>— Reports to —</option>
              {members.filter(m => !editMember || m.id !== editMember.id).map(m => (
                <option key={m.id} value={m.id} className={optCls}>{m.full_name}{m.title ? ` · ${m.title}` : ''}</option>
              ))}
            </select>
            <div className="md:col-span-2">
              <input value={memberForm.seat_roles} onChange={e => setMemberForm(p => ({ ...p, seat_roles: e.target.value }))} placeholder="EOS seats (comma-separated) — e.g. Integrator, Visionary" className={fieldCls} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button onClick={() => { setShowMemberForm(false); setEditMember(null); }} className={btnGhost}>Cancel</button>
              <button onClick={saveMember} className={btnPrimary}><Save className="w-3.5 h-3.5" /> {editMember ? 'Update' : 'Add'}</button>
            </div>
          </div>
        )}

        {tree.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {tree.map(node => <OrgNode key={node.id} node={node} depth={0} depts={depts} onEdit={startEdit} onDelete={removeMember} />)}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function OrgNode({ node, depth, depts, onEdit, onDelete }) {
  const deptName = depts.find(d => d.id === node.department_id)?.name;
  return (
    <div>
      <div
        className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg hover:border-emerald-500/30 transition group"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm truncate">{node.full_name}</p>
            {node.title && <span className="text-xs text-slate-400">· {node.title}</span>}
            {deptName && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-500/20">{deptName}</span>}
          </div>
          {(node.seat_roles || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(node.seat_roles || []).map(r => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/15 text-purple-300 border border-purple-500/20">{r}</span>
              ))}
            </div>
          )}
          {(node.email || node.phone) && (
            <p className="text-xs text-slate-500 mt-1 truncate">
              {[node.email, node.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(node)} className={btnGhost}><Edit2 className="w-3 h-3" /></button>
          <button onClick={() => onDelete(node.id)} className={btnDanger}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {(node.children || []).map(child => (
        <OrgNode key={child.id} node={child} depth={depth + 1} depts={depts} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Web & SEO Tab
// ─────────────────────────────────────────────────────────────────────
const SOCIAL_FIELDS = [
  { key: 'linkedin',        label: 'LinkedIn',        icon: LinkIcon, placeholder: 'https://linkedin.com/company/…' },
  { key: 'facebook',        label: 'Facebook',        icon: LinkIcon, placeholder: 'https://facebook.com/…' },
  { key: 'instagram',       label: 'Instagram',       icon: LinkIcon, placeholder: 'https://instagram.com/…' },
  { key: 'twitter',         label: 'Twitter / X',     icon: LinkIcon, placeholder: 'https://x.com/…' },
  { key: 'tiktok',          label: 'TikTok',          icon: LinkIcon, placeholder: 'https://tiktok.com/@…' },
  { key: 'youtube',         label: 'YouTube',         icon: LinkIcon, placeholder: 'https://youtube.com/@…' },
  { key: 'yelp',            label: 'Yelp',            icon: MapPin,   placeholder: 'https://yelp.com/biz/…' },
  { key: 'google_business', label: 'Google Business', icon: MapPin,   placeholder: 'https://g.page/…' },
];

export function WebSeoTab({ engagement, onUpdate }) {
  const [form, setForm] = useState(() => {
    const social = engagement.social_urls || {};
    const o = { primary_website: engagement.primary_website || '' };
    SOCIAL_FIELDS.forEach(f => { o[f.key] = social[f.key] || ''; });
    return o;
  });
  const [sites, setSites] = useState([]);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState({ url: '', kind: 'main', is_primary: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchWebsites(engagement.id);
      setSites(list);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [engagement.id]);

  useEffect(() => { reload(); }, [reload]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function saveSocial() {
    setSaving(true);
    try {
      const social_urls = {};
      SOCIAL_FIELDS.forEach(f => { if (form[f.key]) social_urls[f.key] = form[f.key]; });
      await updateEngagement(engagement.id, {
        primary_website: form.primary_website || null,
        social_urls,
      });
      toast.success('Web & social saved');
      onUpdate?.();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function saveSite() {
    if (!siteForm.url.trim()) return toast.error('URL required');
    try {
      await createWebsite(engagement.id, {
        url: siteForm.url.trim(),
        kind: siteForm.kind,
        is_primary: siteForm.is_primary,
        notes: siteForm.notes || null,
      });
      setSiteForm({ url: '', kind: 'main', is_primary: false, notes: '' });
      setShowSiteForm(false);
      toast.success('Site added');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  async function removeSite(id) {
    if (!confirm('Delete this site?')) return;
    try { await deleteWebsite(id); reload(); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <SectionCard icon={Globe} title="Web & Social" subtitle="Every surface they own online">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Primary Website">
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={form.primary_website}
                onChange={e => setF('primary_website', e.target.value)}
                placeholder="https://…"
                className={`${fieldCls} pl-10`}
              />
            </div>
          </Field>
          {SOCIAL_FIELDS.map(f => {
            const Icon = f.icon;
            return (
              <Field key={f.key} label={f.label}>
                <div className="relative">
                  <Icon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={form[f.key]}
                    onChange={e => setF(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={`${fieldCls} pl-10`}
                  />
                </div>
              </Field>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveSocial} disabled={saving} className={btnPrimary}>
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save web & social'}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        icon={LinkIcon}
        title="Additional Websites"
        subtitle="Subdomains, microsites, landing pages"
        action={
          <button onClick={() => setShowSiteForm(v => !v)} className={btnGhost}>
            <Plus className="w-3.5 h-3.5" /> Add site
          </button>
        }
      >
        {showSiteForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-3 bg-slate-800/40 rounded-lg">
            <input value={siteForm.url} onChange={e => setSiteForm(p => ({ ...p, url: e.target.value }))} placeholder="https://…" className={`${fieldCls} md:col-span-2`} />
            <select value={siteForm.kind} onChange={e => setSiteForm(p => ({ ...p, kind: e.target.value }))} className={fieldCls}>
              {WEBSITE_KINDS.map(k => <option key={k.value} value={k.value} className={optCls}>{k.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={siteForm.is_primary} onChange={e => setSiteForm(p => ({ ...p, is_primary: e.target.checked }))} className="w-4 h-4" />
              Primary
            </label>
            <input value={siteForm.notes} onChange={e => setSiteForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" className={`${fieldCls} md:col-span-3`} />
            <button onClick={saveSite} className={btnPrimary}><Save className="w-3.5 h-3.5" /> Save</button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading sites…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No additional sites yet.</p>
        ) : (
          <div className="space-y-2">
            {sites.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-400 hover:text-emerald-300 text-sm truncate">{s.url}</a>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">{WEBSITE_KINDS.find(k => k.value === s.kind)?.label || s.kind}</span>
                    {s.is_primary && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">PRIMARY</span>}
                  </div>
                  {s.notes && <p className="text-xs text-slate-500 mt-1">{s.notes}</p>}
                </div>
                <button onClick={() => removeSite(s.id)} className={btnDanger}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Globe} title="AI SEO Inspection" subtitle="Coming in Wave 3 — Claude-powered site audit">
        <div className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg text-center">
          <p className="text-sm text-slate-400">The AI SEO Inspector will analyze each site for performance, SEO, accessibility, and conversion signals, then surface concrete fixes. Ships next wave.</p>
        </div>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EOS Tab
// ─────────────────────────────────────────────────────────────────────
export function EosTab({ engagement, onUpdate }) {
  const [form, setForm] = useState({
    core_values: engagement.core_values || [],
    core_focus_purpose: engagement.core_focus_purpose || '',
    core_focus_niche: engagement.core_focus_niche || '',
    ten_year_target: engagement.ten_year_target || '',
    three_year_picture: engagement.three_year_picture || '',
    one_year_plan: engagement.one_year_plan || '',
  });
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function addValue() {
    const t = newValue.trim();
    if (!t) return;
    if (form.core_values.includes(t)) return;
    setF('core_values', [...form.core_values, t]);
    setNewValue('');
  }
  function removeValue(v) {
    setF('core_values', form.core_values.filter(x => x !== v));
  }

  async function save() {
    setSaving(true);
    try {
      await updateEngagement(engagement.id, form);
      toast.success('EOS Vision saved');
      onUpdate?.();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <SectionCard icon={Target} title="Core Values" subtitle="The non-negotiables that define the culture">
        <div className="flex flex-wrap gap-2 mb-3">
          {form.core_values.length === 0 && <p className="text-sm text-slate-500">No core values yet.</p>}
          {form.core_values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 text-sm">
              {v}
              <button onClick={() => removeValue(v)} className="hover:text-red-300"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newValue} onChange={e => setNewValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addValue())} placeholder="Add value and press Enter" className={fieldCls} />
          <button onClick={addValue} className={btnGhost}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
      </SectionCard>

      <SectionCard icon={Target} title="Core Focus" subtitle="The 'hedgehog' — why you exist and what you do best">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Purpose / Cause / Passion" hint="Why the company exists">
            <textarea rows={3} value={form.core_focus_purpose} onChange={e => setF('core_focus_purpose', e.target.value)} className={fieldCls} />
          </Field>
          <Field label="Niche" hint="What you do better than anyone">
            <textarea rows={3} value={form.core_focus_niche} onChange={e => setF('core_focus_niche', e.target.value)} className={fieldCls} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={Target} title="Vision Timeline" subtitle="10-year, 3-year, 1-year">
        <div className="space-y-4">
          <Field label="10-Year Target (BHAG)" hint="The big hairy audacious goal">
            <textarea rows={2} value={form.ten_year_target} onChange={e => setF('ten_year_target', e.target.value)} className={fieldCls} />
          </Field>
          <Field label="3-Year Picture" hint="Revenue, profit, what it looks, feels, sounds like">
            <textarea rows={4} value={form.three_year_picture} onChange={e => setF('three_year_picture', e.target.value)} className={fieldCls} />
          </Field>
          <Field label="1-Year Plan" hint="Goals for the next 12 months">
            <textarea rows={4} value={form.one_year_plan} onChange={e => setF('one_year_plan', e.target.value)} className={fieldCls} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={Target} title="Rocks, Scorecard & Issues" subtitle="Quarterly rocks, weekly scorecard, issues list">
        <div className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg text-center">
          <p className="text-sm text-slate-400">Full Rocks + Scorecard + Issues list ships in Wave 4 with the client portal and L10 meeting automation.</p>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save EOS Vision'}
        </button>
      </div>
    </div>
  );
}
