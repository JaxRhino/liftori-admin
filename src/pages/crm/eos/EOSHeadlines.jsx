import React, { useState, useEffect } from 'react';
import { useCrmClient } from '../_shared';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// EOS Headlines — customer & employee good-news wall (tenant DB via useCrmClient).
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';

export default function EOSHeadlines() {
  const { client } = useCrmClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [category, setCategory] = useState('customer');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_headlines').select('*').order('created_at', { ascending: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  async function post() { if (!msg.trim()) return; try { await client.from('eos_headlines').insert({ message: msg.trim(), category }); setMsg(''); load(); } catch (e) { console.error(e); toast.error('Could not post'); } }
  async function remove(r) { try { await client.from('eos_headlines').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1">Headlines</h1>
        <p className="text-gray-400 text-sm mb-5">Customer and employee good news.</p>
        <Card className="bg-navy-900 border-navy-800 p-4 mb-5">
          <div className="flex items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-navy-950 border border-navy-700 rounded-lg px-2 py-2 text-sm text-white"><option value="customer">Customer</option><option value="employee">Employee</option><option value="company">Company</option></select>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') post(); }} placeholder="Share a headline…" className="flex-1 bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
            <Button onClick={post} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Post</Button>
          </div>
        </Card>
        {loading ? <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">Loading…</Card> : rows.length === 0 ? <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No headlines yet.</Card> : (
          <div className="space-y-2">
            {rows.map(r => (
              <Card key={r.id} className="bg-navy-900 border-navy-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><Badge className="bg-brand-blue/20 text-brand-blue text-[10px] mb-1">{r.category || 'company'}</Badge><div className="text-white text-sm">{r.message}</div><div className="text-xs text-gray-500 mt-1">{fmtDate(r.created_at)}</div></div>
                  <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
