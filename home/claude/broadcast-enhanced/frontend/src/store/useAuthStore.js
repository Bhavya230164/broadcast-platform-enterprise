/**
 * Auth Store (Zustand)
 * Manages: user, token, login, logout, dark mode sync
 */
import { create } from "zustand";
import { authService } from "../services/api";

const TOKEN_KEY = "bp_token";
const USER_KEY = "bp_user";

const load = () => {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
    };
  } catch { return { token: null, user: null }; }
};

const useAuthStore = create((set, get) => {
  const { token, user } = load();

  // Apply dark mode class on initial load
  if (user?.preferences?.darkMode) {
    document.documentElement.classList.add("dark");
  }

  return {
    user, token,
    isAuthenticated: !!token && !!user,
    isLoading: false,
    error: null,

    _persist: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      // Sync dark mode with DOM
      if (user.preferences?.darkMode) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
    },

    login: async (email, password) => {
  set({ isLoading: true, error: null });

  try {
    const { data } = await authService.login({ email, password });

    console.log("LOGIN SUCCESS:", data);

    if (data.require2FA) {
      set({ isLoading: false });

      return {
        success: true,
        require2FA: true,
        tempToken: data.tempToken,
      };
    }

    get()._persist(data.token, data.user);

    return {
      success: true,
      role: data.user.role,
    };
  } catch (err) {
    console.log("========== LOGIN ERROR ==========");
    console.log("FULL ERROR:", err);
    console.log("STATUS:", err?.response?.status);
    console.log("RESPONSE DATA:", err?.response?.data);
    console.log("MESSAGE:", err?.message);

    alert(
      JSON.stringify(
        {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        },
        null,
        2
      )
    );

    const message =
      err?.response?.data?.message ||
      err?.message ||
      "Login failed.";

    set({
      error: message,
      isLoading: false,
    });

    return {
      success: false,
      message,
    };
  }
},

    register: async (name, email, password, role = "member") => {
      set({ isLoading: true, error: null });
      try {
        const { data } = await authService.register({ name, email, password, role });
        get()._persist(data.token, data.user);
        return { success: true, role: data.user.role };
      } catch (err) {
        const message = err.response?.data?.message || "Registration failed.";
        set({ error: message, isLoading: false });
        return { success: false, message };
      }
    },



    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      document.documentElement.classList.remove("dark");
      set({ user: null, token: null, isAuthenticated: false, error: null });
    },

    // Update user in store after profile changes
    updateUser: (updatedUser) => {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      if (updatedUser.preferences?.darkMode) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      set({ user: updatedUser });
    },

    setDarkMode: (val) => {
      const user = get().user;
      if (!user) return;
      const updatedUser = { ...user, preferences: { ...user.preferences, darkMode: val } };
      get().updateUser(updatedUser);
    },

    clearError: () => set({ error: null }),
    getToken: () => get().token,
  };
});

export default useAuthStore;
