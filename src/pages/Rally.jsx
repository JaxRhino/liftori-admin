/**
 * Rally — Video Call Hub
 *
 * Central page for managing Rally video calls:
 * - Create guest links (one-time or recurring)
 * - View and manage existing links
 * - See call history
 * - Quick-start a Rally call
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import axios from 'axios';
import {
  Video, Plus, Copy, Trash2, Link2, ExternalLink, Users,
  Clock, RefreshCw, Loader2, Calendar, Shield, CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { toast } from 'sonner';
import { RallyIcon } from '../components/chat/RallyVideoCall';

const API = import.meta.env.VITE_BACKEND_URL || '';

export default function Rally({ embedded = false }) {
  const { token } = useAuth();
  const [links, setLinks] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [maxGuests, setMaxGuests] = useState(10);
  const [creating, setCreating] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLinks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/video/rally-links`, { headers });
      setLinks(res.data.links || []);
    } catch (err) {
      console.error('Error fetching rally links:', err);
    }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/video/calls?limit=10`, { headers });
      setCallHistory(res.data.calls || []);
    } catch (err) {
      console.error('Error fetching call history:', err);
    }
  }, [token]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchLinks(), fetchHistory()]);
      setLoading(false);
    }
    load();
  }, [fetchLinks, fetchHistory]);

  const handleCreateLink = async () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/api/video/rally-links`, {
        title: newTitle.trim(),
        is_recurring: isRecurring,
        max_guests: maxGuests,
      }, { headers });

      const link = res.data.link;
      setLinks(prev => [link, ...prev]);
      setCreateDialogOpen(false);
      setNewTitle('');
      setIsRecurring(false);
      setMaxGuests(10);

      // Copy to clipboard
      const guestUrl = `${window.location.origin}/rally/join/${link.id}`;
      await navigator.clipboard?.writeText(guestUrl);
      toast.success('Guest link created and copied!');
    } catch (err) {
      toast.error('Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (linkId) => {
    const guestUrl = `${window.location.origin}/rally/join/${linkId}`;
    await navigator.clipboard?.writeText(guestUrl);
    setCopiedId(linkId);
    toast.success('Link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeLink = async (linkId) => {
    try {
      await axios.delete(`${API}/api/video/rally-links/${linkId}`, { headers });
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast.success('Link revoked');
    } catch (err) {
      toast.error('Failed to revoke link');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={embedded ? "p-4 space-y-6" : "p-6 max-w-5xl mx-auto space-y-8"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!embedded && (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <RallyIcon className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <h1 className={embedded ? "text-lg font-bold" : "text-2xl font-bold"}>Rally Video Calls</h1>
            {!embedded && <p className="text-muted-foreground text-sm">Video calls and guest meeting links</p>}
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white"
          size={embedded ? "sm" : "default"}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Guest Link
        </Button>
      </div>

      {/* Active Guest Links */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-orange-500" />
          Guest Links
        </h2>

        {links.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No guest links yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a link to invite external people to a Rally video call
              </p>
              <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Link
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {links.map((link) => (
              <Card key={link.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        link.status === 'active'
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Video className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{link.title}</p>
                          {link.is_recurring && (
                            <Badge variant="secondary" className="text-xs">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Recurring
                            </Badge>
                          )}
                          <Badge variant={link.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {link.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {formatDate(link.created_at)}
                          </span>
                          {link.last_used_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last used {formatDate(link.last_used_at)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Max {link.max_guests} guests
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(link.id)}
                        className="gap-1.5"
                      >
                        {copiedId === link.id ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Link
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevokeLink(link.id)}
                        title="Revoke link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Call History */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Calls
        </h2>

        {callHistory.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No call history yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {callHistory.map((call) => (
              <Card key={call.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        call.status === 'active' ? 'bg-green-500/10 text-green-600' :
                        call.status === 'ended' ? 'bg-muted text-muted-foreground' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        <Video className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {call.title || `${call.call_type === 'one_on_one' ? '1:1' : 'Group'} Call`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(call.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {call.participant_ids?.length || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                      <Badge variant={call.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {call.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Guest Link Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RallyIcon className="h-5 w-5" />
              Create Guest Link
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Meeting Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Weekly Vendor Sync"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLink()}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Recurring Link</p>
                <p className="text-xs text-muted-foreground">
                  Link stays active across multiple calls
                </p>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Max Guests</label>
              <Input
                type="number"
                value={maxGuests}
                onChange={(e) => setMaxGuests(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Guests will enter a waiting room. You must admit each guest before they can join the call.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={creating || !newTitle.trim()}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Create & Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
