import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchVoicemails,
  markVoicemailRead,
  archiveVoicemail,
} from '../lib/callCenterService';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import {
  Voicemail,
  Play,
  Pause,
  Archive,
  Clock,
  Phone,
  User,
  Search,
  Filter,
  CheckCircle,
  Inbox,
  Trash2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// VOICEMAILS PAGE
// Full voicemail management with playback, search, archive
// ═══════════════════════════════════════════════════════════════

export default function CallCenterVoicemails() {
  const { user } = useAuth();
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read, archived
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadVoicemails();

    // Real-time subscription for new voicemails
    const channel = supabase
      .channel('voicemails-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cc_voicemails' }, () => {
        loadVoicemails();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadVoicemails() {
    try {
      const data = await fetchVoicemails();
      setVoicemails(data || []);
    } catch (err) {
      console.error('Error loading voicemails:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id) {
    try {
      await markVoicemailRead(id);
      setVoicemails(prev => prev.map(v => v.id === id ? { ...v, is_read: true } : v));
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  }

  async function handleArchive(id) {
    try {
      await archiveVoicemail(id);
      setVoicemails(prev => prev.map(v => v.id === id ? { ...v, status: 'archived' } : v));
      toast.success('Voicemail archived');
    } catch (err) {
      toast.error('Failed to archive');
    }
  }

  function handlePlay(vm) {
    if (playingId === vm.id) {
      // Pause
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play
      if (vm.recording_url) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(vm.recording_url);
        audioRef.current.play().catch(() => toast.error('Unable to play recording'));
        audioRef.current.onended = () => setPlayingId(null);
        setPlayingId(vm.id);

        // Auto-mark as read
        if (!vm.is_read) handleMarkRead(vm.id);
      } else {
        toast.error('No recording URL available');
      }
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // Filter and search
  const filtered = voicemails.filter(v => {
    if (filter === 'unread' && v.is_read) return false;
    if (filter === 'read' && !v.is_read) return false;
    if (filter === 'archived' && v.status !== 'archived') return false;
    if (filter !== 'archived' && v.status === 'archived') return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (v.caller_name || '').toLowerCase();
      const number = (v.from_number || '').toLowerCase();
      const transcript = (v.transcription || '').toLowerCase();
      if (!name.includes(q) && !number.includes(q) && !transcript.includes(q)) return false;
    }
    return true;
  });

  const unreadCount = voicemails.filter(v => !v.is_read && v.status !== 'archived').length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Voicemail size={24} className="text-sky-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Voicemails</h1>
              <p className="text-gray-400 text-sm">
                {voicemails.length} total{unreadCount > 0 ? ` \u2022 ${unreadCount} unread` : ''}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-sm px-3 py-1">
              {unreadCount} New
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, number, or transcript..."
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'read', label: 'Read' },
              { key: 'archived', label: 'Archived' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voicemail List */}
        {loading ? (
          <Card className="bg-slate-800/50 border-slate-700 p-8">
            <p className="text-gray-400 text-center">Loading voicemails...</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700 p-12">
            <div className="text-center">
              <Inbox size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">{search ? 'No voicemails match your search' : filter === 'unread' ? 'No unread voicemails' : 'No voicemails yet'}</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(vm => (
              <Card
                key={vm.id}
                className={`border-slate-700 transition-colors ${
                  !vm.is_read ? 'bg-slate-800/80 border-l-2 border-l-sky-500' : 'bg-slate-800/40'
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => handlePlay(vm)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      playingId === vm.id
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600 hover:text-white'
                    }`}
                  >
                    {playingId === vm.id ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  {/* Caller Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${!vm.is_read ? 'text-white' : 'text-gray-300'}`}>
                        {vm.caller_name || vm.from_number || 'Unknown Caller'}
                      </span>
                      {!vm.is_read && (
                        <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
                      )}
                    </div>
                    {vm.from_number && vm.caller_name && (
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {vm.from_number}
                      </p>
                    )}
                    {vm.transcription && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{vm.transcription}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock size={10} /> {formatDuration(vm.duration)}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">{formatDate(vm.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {!vm.is_read && (
                        <button
                          onClick={() => handleMarkRead(vm.id)}
                          title="Mark as read"
                          className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {vm.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(vm.id)}
                          title="Archive"
                          className="p-1.5 rounded text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
