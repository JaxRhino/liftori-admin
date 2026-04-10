import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

const CATEGORIES = [
  'AI / Tooling',
  'Infrastructure',
  'Domains / DNS',
  'Marketing',
  'Software / SaaS',
  'Contractors',
  'Other',
];

export default function CostTracker() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('All');
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', category: 'AI / Tooling', amount: '', notes: '' });

  useEffect(() => { fetchCosts(); }, []);

  async function fetchCosts() {
    try {
      const { data, error } = await supabase
        .from('operations_costs')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setCosts(data || []);
    } catch (err) {
      console.error('Error fetching costs:', err);
      toast.error('Failed to load costs');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount) {
      toast.error('Description and amount are required');
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase.from('operations_costs').update({
          date: form.date, description: form.description, category: form.category,
          amount: parseFloat(form.amount), notes: form.notes, updated_at: new Date().toISOString(),
        }).eq('id', editing);
        if (error) throw error;
        toast.success('Cost updated');
      } else {
        const { error } = await supabase.from('operations_costs').insert({
          date: form.date, description: form.description, category: form.category,
          amount: parseFloat(form.amount), notes: form.notes, created_by: user?.id,
        });
        if (error) throw error;
        toast.success('Cost added');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ date: new Date().toISOString().split('T')[0], description: '', category: 'AI / Tooling', amount: '', notes: '' });
      fetchCosts();
    } catch (err) {
      console.error('Error saving cost:', err);
      toast.error('Failed to save');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this cost entry?')) return;
    try {
      const { error } = await supabase.from('operations_costs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      fetchCosts();
    } catch (err) {
      toast.error('Failed to delete');
    }
  }

  function startEdit(cost) {
    setForm({ date: cost.date, description: cost.description, category: cost.category, amount: cost.amount.toString(), notes: cost.notes || '' });
    setEditing(cost.id);
    setShowForm(true);
  }

  const filtered = filterCat === 'All' ? costs : costs.filter(c => c.category === filterCat);
  const totalAll = costs.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const totalFiltered = filtered.reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  // Category breakdown
  const byCat = {};
  costs.forEach(c => { byCat[c.category] = (byCat[c.category] || 0) + parseFloat(c.amount || 0); });

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cost Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Operations costs and running totals</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ date: new Date().toISOString().split('T')[0], description: '', category: 'AI / Tooling', amount: '', notes: '' }); }}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Cost
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase">Total Spend</p>
          <p className="text-2xl font-bold text-white mt-1">${totalAll.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase">Entries</p>
          <p className="text-2xl font-bold text-white mt-1">{costs.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase">Categories</p>
          <p className="text-2xl font-bold text-white mt-1">{Object.keys(byCat).length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase">This Month</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${costs.filter(c => c.date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, c) => s + parseFloat(c.amount || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCat).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-xs font-medium uppercase mb-3">By Category</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'All' : cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCat === cat ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {cat}: ${amt.toFixed(2)}
              </button>
            ))}
            {filterCat !== 'All' && (
              <button onClick={() => setFilterCat('All')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-slate-400 hover:text-white">
                Clear Filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">{editing ? 'Edit Cost' : 'Add New Cost'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Claude API Tokens" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Notes (optional)</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional details..." className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {editing ? 'Update' : 'Add Cost'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cost table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-4 py-3">Date</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Description</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Category</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Amount</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Running Total</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Notes</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No costs recorded yet</td></tr>
              ) : (
                (() => {
                  // Calculate running totals (oldest first)
                  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
                  let runningTotal = 0;
                  const withRunning = sorted.map(c => { runningTotal += parseFloat(c.amount || 0); return { ...c, runningTotal }; });
                  // Display newest first
                  return withRunning.reverse().map(cost => (
                    <tr key={cost.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{cost.date}</td>
                      <td className="px-4 py-3 text-white font-medium">{cost.description}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">{cost.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 font-medium">${parseFloat(cost.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400 font-medium">${cost.runningTotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{cost.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(cost)} className="text-sky-400 hover:text-sky-300 text-xs mr-3">Edit</button>
                        <button onClick={() => handleDelete(cost.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td className="px-4 py-3 text-white font-semibold" colSpan={3}>
                    {filterCat !== 'All' ? `Total (${filterCat})` : 'Grand Total'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 font-bold">${totalFiltered.toFixed(2)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
