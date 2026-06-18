import { create } from "zustand";
import { privateMessageService } from "../services/api";

const getUserId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id || value.id || null;
};

const getUnreadTotal = (users = []) =>
  users.reduce((total, user) => total + (Number(user.unreadCount) || 0), 0);

const usePrivateChatStore = create((set, get) => ({
  users: [],
  activeChatUser: null,
  messages: [],
  unreadTotal: 0,
  isChatPageOpen: false,
  isLoadingUsers: false,
  isLoadingMessages: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoadingUsers: true, error: null });
    try {
      const { data } = await privateMessageService.getUsers();
      const users = (data.data || []).map((user) =>
        get().isChatPageOpen ? { ...user, unreadCount: 0 } : user
      );
      set({ users, unreadTotal: getUnreadTotal(users) });
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
        unreadTotal: getUnreadTotal(state.users.map((u) => (u._id === userId ? { ...u, unreadCount: 0 } : u))),
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
      const senderId = getUserId(message.senderId);
      const isForActiveChat = state.isChatPageOpen && state.activeChatUser && state.activeChatUser._id === senderId;
      
      const newMessages = isForActiveChat ? [...state.messages, message] : state.messages;
      
      const newUsers = state.users.map((u) => {
        if (u._id === senderId) {
          return {
            ...u,
            latestMessage: message,
            unreadCount: isForActiveChat ? 0 : (u.unreadCount || 0) + 1,
          };
        }
        return u;
      }).sort((a, b) => new Date(b.latestMessage?.createdAt || 0) - new Date(a.latestMessage?.createdAt || 0));

      if (isForActiveChat) {
        privateMessageService.markRead(senderId).catch(() => {});
      }

      return { messages: newMessages, users: newUsers, unreadTotal: getUnreadTotal(newUsers) };
    });
  },

  setChatPageOpen: (isOpen) => {
    set((state) => {
      if (!isOpen) return { isChatPageOpen: false };

      const users = state.users.map((user) => ({ ...user, unreadCount: 0 }));
      return { isChatPageOpen: true, users, unreadTotal: 0 };
    });
  },

  clearUnreadTotal: () => {
    set((state) => ({
      users: state.users.map((user) => ({ ...user, unreadCount: 0 })),
      unreadTotal: 0,
    }));
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
