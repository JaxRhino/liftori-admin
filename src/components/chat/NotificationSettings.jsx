import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Volume2, VolumeX, Moon } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const NotificationSettings = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    desktop_notifications: true,
    sound_enabled: true,
    dnd_enabled: false,
    dnd_start: '',
    dnd_end: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .select('notification_settings')
        .eq('user_id', authUser.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const notifSettings = data?.notification_settings || {};
      setSettings({
        desktop_notifications: notifSettings.desktop_notifications ?? true,
        sound_enabled: notifSettings.sound_enabled ?? true,
        dnd_enabled: notifSettings.dnd_enabled ?? false,
        dnd_start: notifSettings.dnd_start || '',
        dnd_end: notifSettings.dnd_end || ''
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          notification_settings: settings
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      toast.success('Notification settings saved');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Desktop notifications enabled!');
        setSettings(prev => ({ ...prev, desktop_notifications: true }));
      } else {
        toast.error('Desktop notifications blocked by browser');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications even when the app is not in focus
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!('Notification' in window && Notification.permission === 'granted') && (
                <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
                  Enable
                </Button>
              )}
              <Switch
                checked={settings.desktop_notifications}
                onCheckedChange={() => handleToggle('desktop_notifications')}
              />
            </div>
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                {settings.sound_enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Sound
              </Label>
              <p className="text-sm text-muted-foreground">
                Play a sound when you receive a message
              </p>
            </div>
            <Switch
              checked={settings.sound_enabled}
              onCheckedChange={() => handleToggle('sound_enabled')}
            />
          </div>

          {/* Do Not Disturb */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Do Not Disturb
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pause all notifications during set hours
                </p>
              </div>
              <Switch
                checked={settings.dnd_enabled}
                onCheckedChange={() => handleToggle('dnd_enabled')}
              />
            </div>

            {settings.dnd_enabled && (
              <div className="flex items-center gap-4 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={settings.dnd_start}
                    onChange={(e) => setSettings(prev => ({ ...prev, dnd_start: e.target.value }))}
                    className="w-32"
                  />
                </div>
                <span className="text-muted-foreground mt-5">to</span>
                <div className="space-y-1">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={settings.dnd_end}
                    onChange={(e) => setSettings(prev => ({ ...prev, dnd_end: e.target.value }))}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettings;
