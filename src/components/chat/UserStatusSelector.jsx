import React, { useState, useEffect } from 'react';
import { Circle, Clock, Moon, MinusCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', icon: Circle, color: 'text-green-500 fill-green-500' },
  { value: 'away', label: 'Away', icon: Clock, color: 'text-yellow-500 fill-yellow-500' },
  { value: 'dnd', label: 'Do Not Disturb', icon: MinusCircle, color: 'text-red-500' },
  { value: 'offline', label: 'Invisible', icon: Circle, color: 'text-gray-400' },
];

const COMMON_STATUSES = [
  { emoji: '📅', text: 'In a meeting' },
  { emoji: '🏠', text: 'Working from home' },
  { emoji: '🚗', text: 'Commuting' },
  { emoji: '🤒', text: 'Out sick' },
  { emoji: '🌴', text: 'Vacationing' },
  { emoji: '💻', text: 'Focusing' },
];

const UserStatusSelector = ({ currentStatus, onStatusChange }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus?.status || 'online');
  const [customEmoji, setCustomEmoji] = useState(currentStatus?.custom_emoji || '');
  const [customStatus, setCustomStatus] = useState(currentStatus?.custom_status || '');

  useEffect(() => {
    if (currentStatus) {
      setStatus(currentStatus.status || 'online');
      setCustomEmoji(currentStatus.custom_emoji || '');
      setCustomStatus(currentStatus.custom_status || '');
    }
  }, [currentStatus]);

  const handleStatusChange = async (newStatus) => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          presence_status: newStatus,
          custom_status: customStatus,
          custom_emoji: customEmoji
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      setStatus(newStatus);
      onStatusChange && onStatusChange(data);
      toast.success(`Status set to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleCustomStatusChange = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          presence_status: status,
          custom_status: customStatus,
          custom_emoji: customEmoji
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      onStatusChange && onStatusChange(data);
      toast.success('Status updated');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleQuickStatus = async (preset) => {
    setCustomEmoji(preset.emoji);
    setCustomStatus(preset.text);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          presence_status: status,
          custom_status: preset.text,
          custom_emoji: preset.emoji
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      onStatusChange && onStatusChange(data);
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const clearCustomStatus = async () => {
    setCustomEmoji('');
    setCustomStatus('');
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          presence_status: status,
          custom_status: null,
          custom_emoji: null
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      onStatusChange && onStatusChange(data);
      toast.success('Custom status cleared');
    } catch (error) {
      toast.error('Failed to clear status');
    }
  };

  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  const StatusIcon = currentStatusOption.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto py-1 px-2 justify-start gap-2">
          <StatusIcon className={`h-3 w-3 ${currentStatusOption.color}`} />
          <span className="text-sm">
            {customEmoji && <span className="mr-1">{customEmoji}</span>}
            {customStatus || currentStatusOption.label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <p className="font-medium text-sm mb-2">Set your status</p>
          <div className="grid grid-cols-2 gap-1">
            {STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    status === option.value
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Icon className={`h-3 w-3 ${option.color}`} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-b">
          <p className="font-medium text-sm mb-2">Custom status</p>
          <div className="flex gap-2 mb-2">
            <Input
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              placeholder="😀"
              className="w-14 text-center"
              maxLength={2}
            />
            <Input
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What's your status?"
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCustomStatusChange} className="flex-1">
              Save
            </Button>
            {(customEmoji || customStatus) && (
              <Button size="sm" variant="outline" onClick={clearCustomStatus}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="p-3">
          <p className="font-medium text-sm mb-2">Quick presets</p>
          <div className="space-y-1">
            {COMMON_STATUSES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickStatus(preset)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
              >
                <span>{preset.emoji}</span>
                <span>{preset.text}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserStatusSelector;
