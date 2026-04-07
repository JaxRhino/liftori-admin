import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchChannels, createChannel, updateChannel, deleteChannel,
} from '../../lib/commsService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Mail, MessageSquare, Share2, Globe, MessageCircle, Smartphone,
  Phone, Plus, Settings, Trash2, Check, AlertCircle, Clock,
} from 'lucide-react';

const CHANNEL_TYPES = [
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-blue-500/20 text-blue-400',
    description: 'Connect email inbox for customer support',
  },
  {
    id: 'sms',
    name: 'SMS',
    icon: Smartphone,
    color: 'bg-green-500/20 text-green-400',
    description: 'Send and receive SMS messages',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Share2,
    color: 'bg-indigo-500/20 text-indigo-400',
    description: 'Connect Facebook Messenger',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Globe,
    color: 'bg-pink-500/20 text-pink-400',
    description: 'Connect Instagram Direct Messages',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-emerald-500/20 text-emerald-400',
    description: 'Connect WhatsApp Business',
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: MessageSquare,
    color: 'bg-sky-500/20 text-sky-400',
    description: 'Connect Twitter Direct Messages',
  },
  {
    id: 'webchat',
    name: 'Web Chat',
    icon: Globe,
    color: 'bg-purple-500/20 text-purple-400',
    description: 'Embed chat widget on your website',
  },
  {
    id: 'phone',
    name: 'Phone',
    icon: Phone,
    color: 'bg-orange-500/20 text-orange-400',
    description: 'Incoming phone call management',
  },
];

export default function ChannelsSettings() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    channel_type: '',
    account_id: '',
    account_name: '',
    config: '{}',
  });

  useEffect(() => {
    fetchChannelsData();
  }, []);

  async function fetchChannelsData() {
    try {
      setLoading(true);
      const data = await fetchChannels();
      setChannels(data);
    } catch (err) {
      console.error('[Channels] Fetch error:', err);
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog(channelType) {
    setEditingChannel(null);
    setFormData({
      name: `${CHANNEL_TYPES.find(t => t.id === channelType)?.name || 'Channel'}`,
      channel_type: channelType,
      account_id: '',
      account_name: '',
      config: '{}',
    });
    setShowDialog(true);
  }

  function openEditDialog(channel) {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      channel_type: channel.channel_type,
      account_id: channel.account_id || '',
      account_name: channel.account_name || '',
      config: channel.config ? JSON.stringify(channel.config) : '{}',
    });
    setShowDialog(true);
  }

  async function handleSaveChannel() {
    if (!formData.name.trim() || !formData.account_id.trim()) {
      toast.error('Name and Account ID are required');
      return;
    }

    try {
      let config = {};
      try {
        config = JSON.parse(formData.config);
      } catch (e) {
        toast.error('Invalid JSON in config');
        return;
      }

      const payload = {
        name: formData.name,
        channel_type: formData.channel_type,
        account_id: formData.account_id,
        account_name: formData.account_name,
        config,
        is_active: true,
      };

      if (editingChannel) {
        const updated = await updateChannel(editingChannel.id, payload);
        setChannels(prev => prev.map(c => c.id === editingChannel.id ? updated : c));
        toast.success(`${formData.name} updated`);
      } else {
        const created = await createChannel(payload);
        setChannels(prev => [created, ...prev]);
        toast.success(`${formData.name} connected`);
      }

      setShowDialog(false);
      setEditingChannel(null);
      setFormData({
        name: '',
        channel_type: '',
        account_id: '',
        account_name: '',
        config: '{}',
      });
    } catch (err) {
      console.error('[Channels] Save error:', err);
      toast.error('Failed to save channel');
    }
  }

  async function handleDeleteChannel() {
    if (!deleteTarget) return;
    try {
      await deleteChannel(deleteTarget.id);
      setChannels(prev => prev.filter(c => c.id !== deleteTarget.id));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      toast.success('Channel disconnected');
    } catch (err) {
      console.error('[Channels] Delete error:', err);
      toast.error('Failed to disconnect channel');
    }
  }

  const getChannelType = (typeId) => CHANNEL_TYPES.find(t => t.id === typeId);

  const connectedChannels = channels;
  const availableChannelTypes = CHANNEL_TYPES.filter(
    type => !channels.some(c => c.channel_type === type.id)
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-sky-500" />
          <p className="mt-4 text-gray-400">Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Communication Channels</h1>
          <p className="mt-2 text-gray-400">
            Connect your customer communication channels to centralize all conversations
          </p>
        </div>

        {/* Connected Channels */}
        {connectedChannels.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-white">Connected Channels</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {connectedChannels.map(channel => {
                const channelType = getChannelType(channel.channel_type);
                const Icon = channelType?.icon || MessageCircle;

                return (
                  <Card key={channel.id} className="border-slate-700 bg-slate-800/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2 ${channelType?.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-white">{channel.name}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1 capitalize">
                              {channel.channel_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1">
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-400">Connected</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Account Details */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400">Account ID</p>
                        <p className="mt-1 break-all rounded bg-slate-700/50 px-2 py-1 font-mono text-sm text-gray-300">
                          {channel.account_id}
                        </p>
                      </div>

                      {channel.account_name && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Account Name</p>
                          <p className="mt-1 text-sm text-gray-300">{channel.account_name}</p>
                        </div>
                      )}

                      {channel.last_sync_at && (
                        <div className="flex items-center gap-2 rounded bg-slate-700/20 px-3 py-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          Last sync: {new Date(channel.last_sync_at).toLocaleDateString()}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(channel)}
                          className="flex-1"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:bg-red-500/10"
                          onClick={() => {
                            setDeleteTarget(channel);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Channels */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">
            {availableChannelTypes.length > 0 ? 'Connect a New Channel' : 'All Channels Connected'}
          </h2>
          {availableChannelTypes.length === 0 ? (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Check className="h-12 w-12 text-emerald-400 mb-4" />
                <p className="text-lg font-semibold text-white">All Channels Connected</p>
                <p className="mt-2 text-sm text-gray-400">
                  You have successfully connected all available communication channels
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {availableChannelTypes.map(channelType => {
                const Icon = channelType.icon;

                return (
                  <Card
                    key={channelType.id}
                    className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors cursor-pointer"
                    onClick={() => openCreateDialog(channelType.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2 ${channelType.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-white">{channelType.name}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1">
                              {channelType.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <Button
                        size="sm"
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateDialog(channelType.id);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect Channel
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog - Create/Edit Channel */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingChannel ? 'Edit Channel' : `Connect ${CHANNEL_TYPES.find(t => t.id === formData.channel_type)?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-400">Channel Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Email, Support SMS"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">Account ID</label>
              <Input
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                placeholder="e.g., your-email@company.com or phone number"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter your email, phone number, or API key for this channel
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">Account Name (Optional)</label>
              <Input
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="e.g., Company Email"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">
                Configuration JSON (Optional)
              </label>
              <Textarea
                value={formData.config}
                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                placeholder='{"key": "value"}'
                className="mt-1 bg-slate-700/50 border-slate-600 text-white font-mono text-sm resize-none"
                rows={4}
              />
              <p className="mt-1 text-xs text-gray-500">
                Add any additional configuration parameters as JSON
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChannel}>
              {editingChannel ? 'Update' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Disconnect Channel?
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            Disconnecting <strong>{deleteTarget?.name}</strong> will stop syncing messages from
            this channel. Existing conversations will remain, but you won't receive new messages.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChannel}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
