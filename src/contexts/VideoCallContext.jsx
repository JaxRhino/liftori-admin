import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import * as videoSvc from '../lib/videoService';
import { toast } from 'sonner';

// WebRTC Configuration — STUN + TURN for NAT traversal
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ]
};

const VideoCallContext = createContext(null);

export const useVideoCallContext = () => {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCallContext must be used within VideoCallProvider');
  }
  return context;
};

export const VideoCallProvider = ({ children }) => {
  const { user } = useAuth();

  // Call state
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [participants, setParticipants] = useState([]);

  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false
  });

  // Refs
  const peerConnections = useRef({});
  const activeCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const pollingRef = useRef(null);
  const pendingOffersRef = useRef([]);
  const subscriptionsRef = useRef([]);

  // Keep refs synced
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);

    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    pendingOffersRef.current = [];

    // Unsubscribe from all Supabase channels
    subscriptionsRef.current.forEach(ch => supabase.removeChannel(ch));
    subscriptionsRef.current = [];

    setActiveCall(null);
    setParticipants([]);
    setRemoteStreams({});
    setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });
    setIncomingCall(null);
  }, []);

  // Send WebRTC signal via Supabase
  const sendSignalToUser = useCallback(async (type, toUserId, data) => {
    const call = activeCallRef.current;
    if (!call || !user) return;

    try {
      await videoSvc.sendSignal(call.id, user.id, toUserId, type, data);
    } catch (error) {
      console.error('Signal error:', error);
    }
  }, [user]);

  // Create peer connection
  const createPeerConnection = useCallback((userId, stream) => {
    if (peerConnections.current[userId]) {
      peerConnections.current[userId].close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current[userId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalToUser('ice-candidate', userId, { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}: ${pc.connectionState}`);
    };

    return pc;
  }, [sendSignalToUser]);

  // Handle WebRTC offer (with glare resolution — both sides may send offers)
  const handleOffer = useCallback(async (signal) => {
    const stream = localStreamRef.current;
    if (!stream) {
      pendingOffersRef.current.push(signal);
      return;
    }

    // Glare resolution: if we already have a connection with a local offer,
    // the user with the lower ID yields (accepts the incoming offer instead)
    const existingPc = peerConnections.current[signal.from_user];
    if (existingPc && existingPc.signalingState === 'have-local-offer') {
      // Both sides sent offers — lower ID yields
      if (user.id > signal.from_user) {
        // We have higher ID, ignore their offer (they'll accept ours)
        console.log('Glare: ignoring offer from', signal.from_user, '(we have higher ID)');
        return;
      }
      // We have lower ID — close our connection and accept theirs
      console.log('Glare: accepting offer from', signal.from_user, '(we have lower ID)');
      existingPc.close();
      delete peerConnections.current[signal.from_user];
    }

    const pc = createPeerConnection(signal.from_user, stream);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignalToUser('answer', signal.from_user, { sdp: pc.localDescription });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [user, createPeerConnection, sendSignalToUser]);

  // Process pending offers when stream becomes available
  useEffect(() => {
    if (localStream && pendingOffersRef.current.length > 0) {
      const offersToProcess = [...pendingOffersRef.current];
      pendingOffersRef.current = [];
      offersToProcess.forEach(signal => handleOffer(signal));
    }
  }, [localStream, handleOffer]);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (signal) => {
    const pc = peerConnections.current[signal.from_user];
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (signal) => {
    const pc = peerConnections.current[signal.from_user];
    if (!pc || !signal.payload?.candidate) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  // Subscribe to Supabase Realtime for active call events
  const subscribeToCall = useCallback((callId) => {
    // Subscribe to WebRTC signals for this user
    const signalChannel = videoSvc.subscribeToSignals(callId, user.id, (signal) => {
      switch (signal.signal_type) {
        case 'offer':
          handleOffer(signal);
          break;
        case 'answer':
          handleAnswer(signal);
          break;
        case 'ice-candidate':
          handleIceCandidate(signal);
          break;
      }
    });
    subscriptionsRef.current.push(signalChannel);

    // Subscribe to participant changes (supports both auth users and guests)
    const participantChannel = videoSvc.subscribeToCallParticipants(callId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const p = payload.new;
        // Use guest_id for guests, user_id for authenticated users
        const peerId = p.guest_id || p.user_id;
        if (peerId === user.id) return; // Skip our own insert

        toast.info(`${p.display_name || 'Someone'} joined the call`);

        setParticipants(prev => {
          const exists = prev.find(x => x.peerId === peerId);
          if (exists) return prev.map(x => x.peerId === peerId ? { ...x, ...p, peerId, status: 'connected' } : x);
          return [...prev, { ...p, peerId, status: 'connected', media_state: { audio_enabled: p.is_audio_on, video_enabled: p.is_video_on } }];
        });

        // Create offer for new participant
        const stream = localStreamRef.current;
        if (stream) {
          const pc = createPeerConnection(peerId, stream);
          pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            sendSignalToUser('offer', peerId, { sdp: pc.localDescription });
          }).catch(err => console.error('Error creating offer:', err));
        }
      } else if (payload.eventType === 'UPDATE') {
        const p = payload.new;
        const peerId = p.guest_id || p.user_id;
        if (p.left_at && peerId !== user.id) {
          // Participant left
          toast.info(`${p.display_name || 'Someone'} left the call`);
          setParticipants(prev => prev.filter(x => x.peerId !== peerId));

          if (peerConnections.current[peerId]) {
            peerConnections.current[peerId].close();
            delete peerConnections.current[peerId];
          }
          setRemoteStreams(prev => {
            const updated = { ...prev };
            delete updated[peerId];
            return updated;
          });
        } else if (!p.left_at) {
          // Media state update
          setParticipants(prev => prev.map(x => x.peerId === peerId ? {
            ...x,
            media_state: { audio_enabled: p.is_audio_on, video_enabled: p.is_video_on, screen_sharing: p.is_screen_sharing }
          } : x));
        }
      }
    });
    subscriptionsRef.current.push(participantChannel);

    // Subscribe to call status changes
    const statusChannel = videoSvc.subscribeToCallStatus(callId, (call) => {
      if (call.status === 'ended') {
        toast.info('Call ended');
        cleanup();
      }
    });
    subscriptionsRef.current.push(statusChannel);
  }, [user, handleOffer, handleAnswer, handleIceCandidate, createPeerConnection, sendSignalToUser, cleanup]);

  // Poll for incoming calls
  useEffect(() => {
    if (!user || activeCall) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkForCalls = async () => {
      try {
        const calls = await videoSvc.getIncomingCalls(user.id);
        if (calls.length > 0 && !incomingCall) {
          const call = calls[0];
          const ageSeconds = (Date.now() - new Date(call.created_at).getTime()) / 1000;
          if (ageSeconds > 60) return;

          // Find caller name from participants
          const caller = call.video_call_participants?.find(p => p.user_id === call.created_by);

          setIncomingCall({
            session_id: call.id,
            call_type: call.call_type,
            caller_id: call.created_by,
            caller_name: caller?.display_name || 'Unknown',
            video_enabled: call.call_type === 'video'
          });
        }
      } catch (error) {
        // Ignore polling errors
      }
    };

    checkForCalls();
    pollingRef.current = setInterval(checkForCalls, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user, activeCall, incomingCall]);

  // Get stored device preferences
  const getStoredDevices = useCallback(() => {
    try {
      const stored = localStorage.getItem('videoCallDeviceSettings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // Get media with optional device selection
  const getMedia = useCallback(async (video = true, audio = true, options = {}) => {
    try {
      const { cameraId, microphoneId } = options;
      const storedDevices = getStoredDevices();

      const videoConstraint = video ? (
        cameraId ? { deviceId: { exact: cameraId } } :
        storedDevices.cameraId ? { deviceId: { ideal: storedDevices.cameraId } } :
        true
      ) : false;

      const audioConstraint = audio ? (
        microphoneId ? { deviceId: { exact: microphoneId } } :
        storedDevices.microphoneId ? { deviceId: { ideal: storedDevices.microphoneId } } :
        true
      ) : false;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint
      });

      setLocalStream(stream);
      setMediaState({ audioEnabled: audio, videoEnabled: video, screenSharing: false });
      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      toast.error(`Camera/mic access denied: ${error.message}`);
      throw error;
    }
  }, [getStoredDevices]);

  // Start call with existing stream (from PreCallSettings)
  const startCallWithStream = useCallback(async (participantIds, channelId, callType, existingStream) => {
    try {
      setLocalStream(existingStream);
      localStreamRef.current = existingStream;
      setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });

      const call = await videoSvc.createCall({
        channelId,
        callType,
        participants: participantIds,
      }, user);

      setActiveCall(call);
      activeCallRef.current = call; // Sync ref immediately (useEffect runs after render)

      // Fetch participants
      const fullCall = await videoSvc.getCall(call.id);
      setParticipants((fullCall.video_call_participants || []).map(p => ({
        ...p,
        peerId: p.guest_id || p.user_id,
        status: 'connected',
        media_state: { audio_enabled: p.is_audio_on, video_enabled: p.is_video_on }
      })));

      // Subscribe to Realtime events
      subscribeToCall(call.id);

      return { session: call, participants: fullCall.video_call_participants };
    } catch (error) {
      console.error('Error starting call:', error);
      cleanup();
      throw error;
    }
  }, [user, cleanup, subscribeToCall]);

  // Join call with existing stream (from PreCallSettings)
  const joinCallWithStream = useCallback(async (sessionId, existingStream) => {
    try {
      setLocalStream(existingStream);
      localStreamRef.current = existingStream;
      setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });

      await videoSvc.joinCall(sessionId, user);

      const fullCall = await videoSvc.getCall(sessionId);
      setActiveCall(fullCall);
      activeCallRef.current = fullCall; // Sync ref immediately (useEffect runs after render)
      setParticipants((fullCall.video_call_participants || [])
        .filter(p => !p.left_at)
        .map(p => ({
          ...p,
          peerId: p.guest_id || p.user_id,
          status: 'connected',
          media_state: { audio_enabled: p.is_audio_on, video_enabled: p.is_video_on }
        })));
      setIncomingCall(null);

      // Subscribe to Realtime events
      subscribeToCall(sessionId);

      // Initiate WebRTC offers to all existing participants
      // This avoids the race condition where the host's offer arrives
      // before our signal subscription is active
      const existingParticipants = (fullCall.video_call_participants || [])
        .filter(p => !p.left_at && p.user_id !== user.id);

      for (const p of existingParticipants) {
        const peerId = p.guest_id || p.user_id;
        try {
          const pc = createPeerConnection(peerId, existingStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignalToUser('offer', peerId, { sdp: pc.localDescription });
          console.log('Sent offer to existing participant:', peerId);
        } catch (err) {
          console.error('Error creating offer for existing participant:', err);
        }
      }

      return { session: fullCall, participants: fullCall.video_call_participants };
    } catch (error) {
      console.error('Error joining call:', error);
      cleanup();
      throw error;
    }
  }, [user, cleanup, subscribeToCall, createPeerConnection, sendSignalToUser]);

  // Start call (original method)
  const startCall = useCallback(async (participantIds, channelId = null, callType = 'video') => {
    try {
      const stream = await getMedia(true, true);
      return await startCallWithStream(participantIds, channelId, callType, stream);
    } catch (error) {
      console.error('Error starting call:', error);
      cleanup();
      throw error;
    }
  }, [getMedia, startCallWithStream, cleanup]);

  // Join call
  const joinCall = useCallback(async (sessionId) => {
    try {
      const stream = await getMedia(true, true);
      return await joinCallWithStream(sessionId, stream);
    } catch (error) {
      console.error('Error joining call:', error);
      cleanup();
      throw error;
    }
  }, [getMedia, joinCallWithStream, cleanup]);

  // Leave call
  const leaveCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call && user) {
      try {
        await videoSvc.leaveCall(call.id, user.id);
      } catch (error) {
        console.error('Error leaving call:', error);
      }
    }
    cleanup();
  }, [user, cleanup]);

  // End call
  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call) {
      try {
        await videoSvc.endCall(call.id);
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    cleanup();
  }, [cleanup]);

  // Decline call
  const declineCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    try {
      await videoSvc.declineCall(incomingCall.session_id, user.id);
    } catch (error) {
      console.error('Error declining call:', error);
    }
    setIncomingCall(null);
  }, [incomingCall, user]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMediaState(prev => ({ ...prev, audioEnabled: track.enabled }));

      const call = activeCallRef.current;
      if (call && user) {
        videoSvc.updateMediaState(call.id, user.id, { isAudioOn: track.enabled }).catch(() => {});
      }
    }
  }, [user]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMediaState(prev => ({ ...prev, videoEnabled: track.enabled }));

      const call = activeCallRef.current;
      if (call && user) {
        videoSvc.updateMediaState(call.id, user.id, { isVideoOn: track.enabled }).catch(() => {});
      }
    }
  }, [user]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    const call = activeCallRef.current;

    if (mediaState.screenSharing) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        const currentStream = localStreamRef.current;
        const oldTrack = currentStream?.getVideoTracks()[0];
        if (oldTrack) {
          currentStream.removeTrack(oldTrack);
          oldTrack.stop();
        }

        const newStream = new MediaStream([
          ...currentStream.getAudioTracks(),
          videoTrack
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setMediaState(prev => ({ ...prev, screenSharing: false }));

        if (call && user) {
          videoSvc.updateMediaState(call.id, user.id, { isScreenSharing: false }).catch(() => {});
        }
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => toggleScreenShare();

        const currentStream = localStreamRef.current;
        const oldTrack = currentStream?.getVideoTracks()[0];
        if (oldTrack) {
          currentStream.removeTrack(oldTrack);
          oldTrack.stop();
        }

        const newStream = new MediaStream([
          ...currentStream.getAudioTracks(),
          screenTrack
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setMediaState(prev => ({ ...prev, screenSharing: true }));

        if (call && user) {
          videoSvc.updateMediaState(call.id, user.id, { isScreenSharing: true }).catch(() => {});
        }
      } catch (error) {
        if (error.name !== 'NotAllowedError') {
          toast.error('Could not start screen sharing');
        }
      }
    }
  }, [mediaState.screenSharing, user]);

  const value = {
    activeCall,
    incomingCall,
    participants,
    localStream,
    remoteStreams,
    mediaState,
    startCall,
    joinCall,
    startCallWithStream,
    joinCallWithStream,
    leaveCall,
    endCall,
    declineCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    getMedia,
    getStoredDevices,
    currentUserId: user?.id
  };

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  );
};
