import { create } from "zustand";
import { callService } from "../services/api";

const useCallStore = create((set, get) => ({
  activeCall: null, // { isReceivingCall, caller, signal, name, type (voice/video), stream }
  callHistory: [],
  callAccepted: false,
  callEnded: false,
  remoteStream: null,
  localStream: null,

  setCall: (callData) => set({ activeCall: callData, callEnded: false }),
  acceptCall: () => set({ callAccepted: true }),
  
  fetchHistory: async () => {
    try {
      const { data } = await callService.getHistory();
      set({ callHistory: data.data || [] });
    } catch (err) {
      console.error("Failed to fetch call history", err);
    }
  },

  endCall: () => {
    const { localStream, remoteStream } = get();
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (remoteStream) remoteStream.getTracks().forEach((track) => track.stop());
    
    set({
      activeCall: null,
      callAccepted: false,
      callEnded: true,
      remoteStream: null,
      localStream: null,
    });
  },
  setStreams: ({ localStream, remoteStream }) => set((state) => ({
    localStream: localStream || state.localStream,
    remoteStream: remoteStream || state.remoteStream,
  })),
}));

export default useCallStore;
