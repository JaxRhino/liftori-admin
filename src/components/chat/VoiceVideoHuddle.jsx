import React, { useState } from 'react';
import { 
  Phone, 
  Video, 
  Users, 
  Mic, 
  MicOff, 
  VideoOff,
  PhoneOff,
  Monitor,
  Settings,
  MessageSquare
} from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';

// Voice Call Dialog Component
export const VoiceCallDialog = ({ isOpen, onClose, participant, channelName }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, connected, ended

  const handleEndCall = () => {
    setCallStatus('ended');
    toast.info('Call ended');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            <Phone className="h-5 w-5 inline mr-2" />
            Voice Call
          </DialogTitle>
        </DialogHeader>

        <div className="text-center py-8">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {participant?.charAt(0) || channelName?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-lg">
            {participant || `#${channelName}`}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'connected' && 'Connected'}
            {callStatus === 'ended' && 'Call ended'}
          </p>
          
          {/* Placeholder for call timer */}
          <p className="text-2xl font-mono mt-4 text-muted-foreground">
            00:00
          </p>
        </div>

        <div className="flex justify-center gap-4 pb-4">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Voice calling is coming soon. This is a preview.
        </p>
      </DialogContent>
    </Dialog>
  );
};

// Video Call Dialog Component
export const VideoCallDialog = ({ isOpen, onClose, participant, channelName }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleEndCall = () => {
    toast.info('Video call ended');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Call - {participant || `#${channelName}`}
          </DialogTitle>
        </DialogHeader>

        {/* Video Preview Area */}
        <div className="relative bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center text-white">
            <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Video Preview</p>
            <p className="text-sm opacity-70 mt-2">Video calling coming soon</p>
          </div>
          
          {/* Self-view placeholder */}
          <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg flex items-center justify-center">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm">You</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 py-4">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant={isVideoOff ? "destructive" : "outline"}
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => setIsVideoOff(!isVideoOff)}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          <Button
            variant={isScreenSharing ? "secondary" : "outline"}
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => {
              setIsScreenSharing(!isScreenSharing);
              toast.info('Screen sharing coming soon');
            }}
            title="Share screen"
          >
            <Monitor className="h-5 w-5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={handleEndCall}
            title="End call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Huddle Room Dialog Component
export const HuddleDialog = ({ isOpen, onClose, channelName, participants = [] }) => {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Huddle - #{channelName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Quick audio chat with your team. Join to start talking.
          </p>

          {/* Participants */}
          <div className="space-y-2 mb-6">
            <p className="text-sm font-medium">In this huddle ({participants.length || 0})</p>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No one is in this huddle yet. Be the first to join!
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{p.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button onClick={() => toast.info('Huddles coming soon')}>
              Join Huddle
            </Button>
            <Button variant="outline" onClick={onClose}>
              Leave
            </Button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground border-t pt-3">
          Huddles are coming soon. This is a preview of the feature.
        </p>
      </DialogContent>
    </Dialog>
  );
};

// Quick Call Button Component (for channel header)
export const QuickCallButtons = ({ onVoiceCall, onVideoCall, onHuddle }) => {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onVoiceCall}
        title="Start voice call"
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onVideoCall}
        title="Start video call"
      >
        <Video className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onHuddle}
        title="Start huddle"
      >
        <Users className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default { VoiceCallDialog, VideoCallDialog, HuddleDialog, QuickCallButtons };
