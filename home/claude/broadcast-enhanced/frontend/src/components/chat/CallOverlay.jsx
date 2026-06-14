import { useEffect, useRef } from "react";
import { useSocket } from "../../context/SocketContext";
import useCallStore from "../../store/useCallStore";
import useAuthStore from "../../store/useAuthStore";
import toast from "react-hot-toast";

const UserAvatar = ({ user, size = "md" }) => {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-24 h-24",
  };

  return (
    <div
      className={`${sizes[size]} rounded-full bg-slate-700 flex items-center justify-center text-white font-bold`}
    >
      {user?.name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
};
export default function CallOverlay() {
  const { socket } = useSocket();
  const { user } = useAuthStore();
  const { 
    activeCall, callAccepted, callEnded, remoteStream, localStream,
    setCall, acceptCall, endCall, setStreams
  } = useCallStore();

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const callIdRef = useRef(null);
  const callStartedAtRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on("incoming_call", ({ from, signal, type, callId }) => {
      callIdRef.current = callId;
      setCall({ isReceivingCall: true, caller: from, signal, type, callId });
      toast(`${from?.name || "Someone"} is calling`, { duration: 10000 });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`${from?.name || "Someone"} is calling`, { body: `${type} call` });
      }
    });

    socket.on("call_ended", () => {
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      callIdRef.current = null;
      callStartedAtRef.current = null;
      endCall();
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_ended");
    };
  }, [socket]);

  useEffect(() => {
    if (localStream && myVideo.current) {
      myVideo.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && userVideo.current) {
      userVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream, callAccepted]);

  // Initiate Call
  useEffect(() => {
    if (activeCall && !activeCall.isReceivingCall && !callAccepted && !callEnded) {
      // Setup initiator peer
      const peer = new window.RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      connectionRef.current = peer;
      
      activeCall.stream.getTracks().forEach((track) => peer.addTrack(track, activeCall.stream));
      setStreams({ localStream: activeCall.stream });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", { to: activeCall.caller._id, candidate: event.candidate });
        }
      };

      peer.ontrack = (event) => {
        setStreams({ remoteStream: event.streams[0] });
      };

      peer.createOffer().then((offer) => {
        return peer.setLocalDescription(offer);
      }).then(() => {
        socket.emit("call_user", {
          userToCall: activeCall.caller._id,
          signalData: peer.localDescription,
          from: user,
          type: activeCall.type
        });
      }).catch(console.error);

      // Listen for answer
      socket.once("call_accepted", ({ signal, callId }) => {
        callIdRef.current = callId || callIdRef.current;
        callStartedAtRef.current = Date.now();
        acceptCall();
        peer.setRemoteDescription(new window.RTCSessionDescription(signal));
      });

      socket.once("call_rejected", ({ callId }) => {
        callIdRef.current = callId || callIdRef.current;
        endCurrentCall("rejected");
      });

      socket.once("call_started", ({ callId }) => {
        callIdRef.current = callId || callIdRef.current;
      });

      // Listen for ICE candidates
      const handleIce = ({ candidate }) => {
        peer.addIceCandidate(new window.RTCIceCandidate(candidate)).catch(console.error);
      };
      socket.on("ice_candidate", handleIce);

      return () => {
        socket.off("call_accepted");
        socket.off("call_rejected");
        socket.off("call_started");
        socket.off("ice_candidate", handleIce);
      };
    }
  }, [activeCall, callAccepted, callEnded, socket]);

  const answerCall = async () => {
    acceptCall();
    callStartedAtRef.current = Date.now();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: activeCall.type === "video", audio: true });
      setStreams({ localStream: stream });

      const peer = new window.RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      connectionRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", { to: activeCall.caller._id, candidate: event.candidate });
        }
      };

      peer.ontrack = (event) => {
        setStreams({ remoteStream: event.streams[0] });
      };

      peer.setRemoteDescription(new window.RTCSessionDescription(activeCall.signal)).then(() => {
        return peer.createAnswer();
      }).then((answer) => {
        return peer.setLocalDescription(answer);
      }).then(() => {
        socket.emit("answer_call", { signal: peer.localDescription, to: activeCall.caller._id, callId: activeCall.callId || callIdRef.current });
      }).catch(console.error);

      const handleIce = ({ candidate }) => {
        peer.addIceCandidate(new window.RTCIceCandidate(candidate)).catch(console.error);
      };
      socket.on("ice_candidate", handleIce);
    } catch (err) {
      console.error("Failed to get media", err);
    }
  };

  const rejectCall = () => {
    socket.emit("reject_call", { to: activeCall.caller._id, callId: activeCall.callId || callIdRef.current });
    endCurrentCall("rejected");
  };

  const leaveCall = () => {
    const duration = callStartedAtRef.current ? Math.floor((Date.now() - callStartedAtRef.current) / 1000) : 0;
    const status = callAccepted ? "completed" : "missed";
    socket.emit("end_call", { to: activeCall.caller._id, callId: activeCall.callId || callIdRef.current, duration, status });
    endCurrentCall(status);
  };

  const endCurrentCall = (status = "completed") => {
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    
    callIdRef.current = null;
    callStartedAtRef.current = null;
    
    endCall();
  };

  if (!activeCall && !callAccepted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl w-full max-w-md md:max-w-3xl overflow-hidden relative border border-slate-700">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <UserAvatar user={activeCall?.caller} size="lg" />
          <div className="text-white">
            <h2 className="text-2xl font-light">{activeCall?.caller?.name}</h2>
            <p className="text-brand-400 animate-pulse">
              {callAccepted 
                ? `${activeCall?.type === "video" ? "Video" : "Voice"} call in progress...` 
                : activeCall?.isReceivingCall 
                  ? `Incoming ${activeCall?.type} call...` 
                  : "Calling..."}
            </p>
          </div>
        </div>

        {/* Video Area */}
        {callAccepted && (
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
            {activeCall?.type === "video" ? (
              <>
                <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                <div className="absolute bottom-4 right-4 w-32 aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600 shadow-lg">
                  <video playsInline ref={myVideo} autoPlay muted className="w-full h-full object-cover" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                  <UserAvatar user={activeCall?.caller} size="xl" />
                </div>
                <audio playsInline ref={userVideo} autoPlay />
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mt-8 flex items-center justify-center gap-6">
          {!callAccepted && activeCall?.isReceivingCall ? (
            <>
              <button onClick={answerCall} className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-all hover:scale-105 shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              </button>
              <button onClick={rejectCall} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 shadow-lg shadow-red-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </>
          ) : (
            <button onClick={leaveCall} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 shadow-lg shadow-red-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.684 4.128A1 1 0 008.736 3.44H5z"/></svg>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
