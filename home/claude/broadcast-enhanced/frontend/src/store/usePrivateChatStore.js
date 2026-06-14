import { create } from "zustand";
import { privateMessageService } from "../services/api";

const usePrivateChatStore = create((set, get) => ({
  users: [],
  activeChatUser: null,
  messages: [],
  isLoadingUsers: false,
  isLoadingMessages: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoadingUsers: true, error: null });
    try {
      const { data } = await privateMessageService.getUsers();
      set({ users: data.data || [] });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ isLoadingUsers: false });
    }
  },

  setActiveChatUser: (user) => {
    set({ activeChatUser: user, messages: [] });
    if (user) {
      get().fetchMessages(user._id);
    }
  },

  fetchMessages: async (userId) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const { data } = await privateMessageService.getMessages(userId);
      set({ messages: data.data || [] });
      // Clear unread count for this user
      set((state) => ({
        users: state.users.map((u) => (u._id === userId ? { ...u, unreadCount: 0 } : u)),
      }));
      await privateMessageService.markRead(userId);
    } catch (err) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (userId, formData) => {
    try {
      const { data } = await privateMessageService.send(userId, formData);
      set((state) => ({
        messages: [...state.messages, data.data],
        users: state.users.map((u) =>
          u._id === userId ? { ...u, latestMessage: data.data } : u
        ).sort((a, b) => new Date(b.latestMessage?.createdAt || 0) - new Date(a.latestMessage?.createdAt || 0)),
      }));
    } catch (err) {
      console.error("Failed to send message", err);
    }
  },

  receiveMessage: (message) => {
    set((state) => {
      let isForActiveChat = state.activeChatUser && state.activeChatUser._id === message.senderId._id;
      
      const newMessages = isForActiveChat ? [...state.messages, message] : state.messages;
      
      const newUsers = state.users.map((u) => {
        if (u._id === message.senderId._id) {
          return {
            ...u,
            latestMessage: message,
            unreadCount: isForActiveChat ? 0 : (u.unreadCount || 0) + 1,
          };
        }
        return u;
      }).sort((a, b) => new Date(b.latestMessage?.createdAt || 0) - new Date(a.latestMessage?.createdAt || 0));

      if (isForActiveChat) {
        privateMessageService.markRead(message.senderId._id).catch(() => {});
      }

      return { messages: newMessages, users: newUsers };
    });
  },

  markMessagesReadByOther: (readerId) => {
    set((state) => {
      if (state.activeChatUser && state.activeChatUser._id === readerId) {
        return {
          messages: state.messages.map((m) =>
            m.status !== "read" ? { ...m, status: "read" } : m
          ),
        };
      }
      return state;
    });
  },

  updateUserStatus: ({ userId, isOnline, lastSeen }) => {
    set((state) => ({
      users: state.users.map((u) =>
        u._id === userId ? { ...u, isOnline, lastSeen } : u
      ),
      activeChatUser: state.activeChatUser?._id === userId 
        ? { ...state.activeChatUser, isOnline, lastSeen } 
        : state.activeChatUser
    }));
  }
}));

export default usePrivateChatStore;
