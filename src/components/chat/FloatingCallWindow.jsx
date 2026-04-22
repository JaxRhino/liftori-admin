/**
 * FloatingCallWindow — drop-in replacement for VideoCallRoom.
 *
 * Renders when useVideoCallContext().activeCall is non-null.
 * - Draggable by header (pointer events)
 * - Resizable from bottom-right corner
 * - Full / Mini view toggle
 * - Native Picture-in-Picture button (main remote tile)
 * - Screen share track swap (via context.toggleScreenShare)
 * - Multi-participant grid (auto-layout: 1/2/4/6/9)
 * - Invite button -> InviteToCallModal (separate file)
 *
 * Reads the same context API that VideoCallRoom did, so it's a drop-in swap
 * in AdminLayout.jsx.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVideoCallContext } from '../../contexts/VideoCallContext';
import { useAuth } from '../../lib/AuthContext';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Users, UserPlus, Maximize2, Minimize2,
  PictureInPicture2, GripVertical, X,
} from 'lucide-react';
import { toast } from 'sonner';
import InviteToCallModal from './InviteToCallModal';

// ───────── Layout constants ─────────
const FULL_DEFAULT = { w: 960, h: 600 };
const MINI_SIZE = { w: 280, h: 180 };
const MIN_SIZE = { w: 480, h: 320 };
const MAX_SIZE = { w: 1600, h: 1000 };
const MARGIN = 12; // px from viewport edge
const HEADER_H = 44;

// ───────── Helpers ─────────
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function computeGrid(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(count / 4) };
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// ───────── Sub-components ─────────

function ParticipantTile({ participant, stream, isLocal, isSpeaking, isMain, videoRef }) {
  const innerRef = useRef(null);
  const ref = videoRef || innerRef;

  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream, ref]);

  const mediaState = participant?.media_state || {
    audio_enabled: participant?.is_audio_on,
    video_enabled: participant?.is_video_on,
    screen_sharing: participant?.is_screen_sharing,
  };
  const videoOn = isLocal ? true : mediaState.video_enabled !== false;
  const audioOn = isLocal ? true : mediaState.audio_enabled !== false;
  const name = participant?.display_name || (isLocal ? 'You' : 'Guest');

  return (
    <div className={`relative bg-slate-950 rounded-lg overflow-hidden border transition-all ${
      isSpeaking ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-800'
    }`}>
      {stream && videoOn ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-sky-500/20 border-2 border-sky-500/50 flex items-center justify-center">
            <span className="text-sky-300 text-xl font-semibold">{initials(name)}</span>
          </div>
        </div>
      )}

      {/* Name bar */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1">
        <div className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-xs text-white flex items-center gap-1 max-w-full truncate">
          {!audioOn && <MicOff size={10} className="text-red-400 shrink-0" />}
          <span className="truncate">{name}{isLocal && ' (you)'}</span>
        </div>
        {mediaState.screen_sharing && (
          <div className="bg-sky-500 px-2 py-0.5 rounded text-[10px] text-white font-medium">
            SHARING
          </div>
        )}
      </div>

      {isMain && stream && (
        <button
          onClick={async () => {
            const v = ref.current;
            if (!v) return;
            try {
              if (document.pictureInPictureElement) await document.exitPictureInPicture();
              else await v.requestPictureInPicture();
            } catch (e) { toast.error('PiP unavailable'); }
          }}
          title="Picture-in-Picture (drag to any monitor)"
          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded text-white"
        >
          <PictureInPicture2 size={14} />
        </button>
      )}
    </div>
  );
}

function CallControls({ mediaState, onAudio, onVideo, onScreen, onLeave, onInvite, compact }) {
  const btn = `flex items-center justify-center rounded-full transition-all ${
    compact ? 'w-8 h-8' : 'w-11 h-11'
  }`;
  const iconSize = compact ? 14 : 18;
  return (
    <div className={`flex items-center justify-center gap-2 ${compact ? 'py-1.5' : 'py-3'} px-3 bg-slate-900/90 border-t border-slate-800`}>
      <button
        onClick={onAudio}
        title={mediaState.audioEnabled ? 'Mute' : 'Unmute'}
        className={`${btn} ${mediaState.audioEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
      >
        {mediaState.audioEnabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
      </button>
      <button
        onClick={onVideo}
        title={mediaState.videoEnabled ? 'Stop video' : 'Start video'}
        className={`${btn} ${mediaState.videoEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
      >
        {mediaState.videoEnabled ? <Video size={iconSize} /> : <VideoOff size={iconSize} />}
      </button>
      <button
        onClick={onScreen}
        title={mediaState.screenSharing ? 'Stop sharing' : 'Share screen or tab'}
        className={`${btn} ${mediaState.screenSharing ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
      >
        {mediaState.screenSharing ? <MonitorOff size={iconSize} /> : <Monitor size={iconSize} />}
      </button>
      {!compact && onInvite && (
        <button
          onClick={onInvite}
          title="Invite more people"
          className={`${btn} bg-slate-700 hover:bg-slate-600 text-white`}
        >
          <UserPlus size={iconSize} />
        </button>
      )}
      <button
        onClick={onLeave}
        title="Leave call"
        className={`${btn} bg-red-600 hover:bg-red-700 text-white`}
      >
        <PhoneOff size={iconSize} />
      </button>
    </div>
  );
}

// ───────── Main component ─────────

export default function FloatingCallWindow() {
  const {
    activeCall, participants, localStream, remoteStreams, mediaState,
    leaveCall, endCall, toggleAudio, toggleVideo, toggleScreenShare,
    currentUserId,
  } = useVideoCallContext();
  const { user } = useAuth();

  // Window geometry
  const [pos, setPos] = useState(() => {
    const w = FULL_DEFAULT.w;
    const h = FULL_DEFAULT.h;
    return {
      x: Math.max(MARGIN, (window.innerWidth - w) / 2),
      y: Math.max(MARGIN, (window.innerHeight - h) / 2),
    };
  });
  const [size, setSize] = useState(FULL_DEFAULT);
  const [isMini, setIsMini] = useState(false);
  const [isMaxed, setIsMaxed] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Geometry cache for restore after mini / max
  const preMini = useRef({ pos: null, size: null });
  const preMax = useRef({ pos: null, size: null });

  // Call duration timer
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (!activeCall?.started_at && !activeCall?.created_at) return;
    const startedAt = new Date(activeCall.started_at || activeCall.created_at).getTime();
    const tick = () => setDuration(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCall?.started_at, activeCall?.created_at]);

  // Clamp on viewport resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, MARGIN, window.innerWidth - size.w - MARGIN),
        y: clamp(p.y, MARGIN, window.innerHeight - size.h - MARGIN),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size.w, size.h]);

  // Drag state
  const dragState = useRef(null);
  const onHeaderPointerDown = useCallback((e) => {
    if (isMaxed) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos.x, pos.y, isMaxed]);
  const onHeaderPointerMove = useCallback((e) => {
    const d = dragState.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPos({
      x: clamp(d.origX + dx, MARGIN, window.innerWidth - size.w - MARGIN),
      y: clamp(d.origY + dy, MARGIN, window.innerHeight - size.h - MARGIN),
    });
  }, [size.w, size.h]);
  const onHeaderPointerUp = useCallback((e) => {
    dragState.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  // Resize state (bottom-right corner)
  const resizeState = useRef(null);
  const onResizePointerDown = useCallback((e) => {
    if (isMini || isMaxed) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    resizeState.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
  }, [size.w, size.h, isMini, isMaxed]);
  const onResizePointerMove = useCallback((e) => {
    const d = resizeState.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setSize({
      w: clamp(d.origW + dx, MIN_SIZE.w, MAX_SIZE.w),
      h: clamp(d.origH + dy, MIN_SIZE.h, MAX_SIZE.h),
    });
  }, []);
  const onResizePointerUp = useCallback((e) => {
    resizeState.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  // Toggle actions
  const toggleMini = () => {
    if (isMini) {
      const prev = preMini.current;
      if (prev.pos && prev.size) { setPos(prev.pos); setSize(prev.size); }
      else { setSize(FULL_DEFAULT); }
      setIsMini(false);
    } else {
      preMini.current = { pos, size };
      setSize(MINI_SIZE);
      setPos({
        x: window.innerWidth - MINI_SIZE.w - MARGIN,
        y: window.innerHeight - MINI_SIZE.h - MARGIN,
      });
      setIsMini(true);
      setIsMaxed(false);
    }
  };

  const toggleMax = () => {
    if (isMaxed) {
      const prev = preMax.current;
      if (prev.pos && prev.size) { setPos(prev.pos); setSize(prev.size); }
      setIsMaxed(false);
    } else {
      preMax.current = { pos, size };
      setPos({ x: MARGIN, y: MARGIN });
      setSize({
        w: window.innerWidth - MARGIN * 2,
        h: window.innerHeight - MARGIN * 2,
      });
      setIsMaxed(true);
      setIsMini(false);
    }
  };

  // Compute remote tiles (exclude self, keep only connected)
  const remoteParticipants = useMemo(() => (
    (participants || []).filter(p => p.user_id !== currentUserId && !p.left_at)
  ), [participants, currentUserId]);

  const gridTiles = useMemo(() => {
    const tiles = remoteParticipants.map(p => ({
      kind: 'remote',
      participant: p,
      stream: remoteStreams[p.user_id] || null,
    }));
    // Local is always shown (PiP in full, main in solo)
    return tiles;
  }, [remoteParticipants, remoteStreams]);

  const { cols, rows } = computeGrid(Math.max(1, gridTiles.length));
  const mainRemoteRef = useRef(null);

  if (!activeCall) return null;

  const titleBase = activeCall.title || (remoteParticipants[0]?.display_name
    ? `Call with ${remoteParticipants[0].display_name}${remoteParticipants.length > 1 ? ` +${remoteParticipants.length - 1}` : ''}`
    : 'Video Call');

  const durationLabel = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;

  // ────── Mini view: tiny floating card with only local + mute/leave ──────
  if (isMini) {
    return (
      <div
        role="dialog"
        aria-label="Call — mini view"
        className="fixed z-[95] shadow-2xl rounded-lg overflow-hidden border border-slate-700 bg-slate-900 select-none"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        <div
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          className="h-7 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-2 cursor-move"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono">{durationLabel}</span>
            <span className="text-slate-500">· {remoteParticipants.length + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleMini} title="Expand" className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
              <Maximize2 size={11} />
            </button>
          </div>
        </div>
        <div className="relative bg-black" style={{ height: size.h - 28 - 32 }}>
          <ParticipantTile
            participant={remoteParticipants[0] || { display_name: 'Waiting...' }}
            stream={remoteParticipants[0] ? remoteStreams[remoteParticipants[0].user_id] : null}
            isLocal={false}
            isMain={false}
          />
        </div>
        <CallControls
          compact
          mediaState={mediaState}
          onAudio={toggleAudio}
          onVideo={toggleVideo}
          onScreen={toggleScreenShare}
          onLeave={leaveCall}
        />
      </div>
    );
  }

  // ────── Full / maxed view ──────
  return (
    <>
      <div
        role="dialog"
        aria-label="Video call"
        className="fixed z-[95] shadow-2xl rounded-xl overflow-hidden border border-slate-700 bg-[#060B18] flex flex-col select-none"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        {/* Header / drag handle */}
        <div
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          className="flex items-center justify-between px-3 bg-slate-900 border-b border-slate-800 cursor-move"
          style={{ height: HEADER_H }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical size={14} className="text-slate-500 shrink-0" />
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
            <span className="font-semibold text-sm text-white truncate">{titleBase}</span>
            <span className="text-xs font-mono text-slate-400 shrink-0">· {durationLabel}</span>
            <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
              <Users size={12} />{remoteParticipants.length + 1}
            </span>
          </div>
          <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setInviteOpen(true)}
              title="Invite more people"
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            >
              <UserPlus size={14} />
            </button>
            <button
              onClick={toggleMax}
              title={isMaxed ? 'Restore' : 'Maximize'}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            >
              {isMaxed ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={toggleMini}
              title="Mini view"
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {gridTiles.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-sky-500/20 border-2 border-sky-500/50 flex items-center justify-center mx-auto mb-3">
                  <Users size={32} className="text-sky-300" />
                </div>
                <p className="text-slate-300 font-medium">Waiting for others to join...</p>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg"
                >
                  <UserPlus size={14} /> Invite someone
                </button>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 p-2 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {gridTiles.map((tile, i) => (
                <ParticipantTile
                  key={tile.participant?.user_id || i}
                  participant={tile.participant}
                  stream={tile.stream}
                  isLocal={false}
                  isMain={i === 0}
                  videoRef={i === 0 ? mainRemoteRef : undefined}
                />
              ))}
            </div>
          )}

          {/* Local PiP overlay (bottom-right of video area) */}
          {localStream && (
            <div className="absolute bottom-3 right-3 w-40 h-28 rounded-lg overflow-hidden border border-slate-700 shadow-xl pointer-events-none">
              <ParticipantTile
                participant={{ display_name: user?.email?.split('@')[0] || 'You' }}
                stream={localStream}
                isLocal={true}
                isMain={false}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <CallControls
          mediaState={mediaState}
          onAudio={toggleAudio}
          onVideo={toggleVideo}
          onScreen={toggleScreenShare}
          onLeave={leaveCall}
          onInvite={() => setInviteOpen(true)}
        />

        {/* Resize handle — bottom-right corner */}
        {!isMaxed && (
          <div
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.5) 50%)',
            }}
            title="Drag to resize"
          />
        )}
      </div>

      <InviteToCallModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        callId={activeCall.id}
        channelId={activeCall.channel_id}
      />
    </>
  );
}
