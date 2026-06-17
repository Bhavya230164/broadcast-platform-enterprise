/**
 * Axios API service — all backend calls go through here
 * Automatically attaches JWT, handles 401 expiry
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

console.log("BASE_URL =", BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});



// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

// Handle auth expiry globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("bp_token");
      localStorage.removeItem("bp_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Reusable service functions ─────────────────────────────────────────────────

// Auth
export const authService = {
  register: (d) => api.post("/auth/register", d),
  login: (d) => api.post("/auth/login", d),
  getMe: () => api.get("/auth/me"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (d) => api.post("/auth/reset-password", d),
  changePassword: (d) => api.post("/auth/change-password", d),
  verify2FA: (token, tempToken) => api.post("/auth/verify-2fa", { token }, { headers: { Authorization: `Bearer ${tempToken}` } }),
  setup2FA: () => api.get("/auth/2fa/setup"),
  enable2FA: (token) => api.post("/auth/2fa/enable", { token }),
  disable2FA: () => api.post("/auth/2fa/disable"),
};

// Profile
export const profileService = {
  get: () => api.get("/profile"),
  update: (d) => api.patch("/profile", d),
  uploadAvatar: (formData) => api.post("/profile/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  removeAvatar: () => api.delete("/profile/avatar"),
  toggleDarkMode: () => api.patch("/profile/dark-mode"),
};

// Groups
export const groupService = {
  getAll: () => api.get("/groups"),
  getMine: () => api.get("/groups/mine"),
  getUsers: () => api.get("/groups/users"),
  create: (d) => api.post("/groups", d),
  update: (id, d) => api.patch(`/groups/${id}`, d),
  delete: (id) => api.delete(`/groups/${id}`),
  addMembers: (id, d) => api.post(`/groups/${id}/members`, d),
  removeMember: (id, mid) => api.delete(`/groups/${id}/members/${mid}`),
};

// Messages
export const messageService = {
  send: (formData) => api.post("/messages/send", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  getInbox: (params) => api.get("/messages/inbox", { params }),
  getGroupMessages: (gid) => api.get(`/messages/group/${gid}`),
  markRead: (id) => api.patch(`/messages/${id}/read`),
  acknowledge: (id) => api.patch(`/messages/${id}/acknowledge`),
  togglePin: (id) => api.patch(`/messages/${id}/pin`),
  getPinned: () => api.get("/messages/pinned"),
};

// Meetings
export const meetingService = {
  create: (d) => api.post("/meetings", d),
  getAdminMeetings: () => api.get("/meetings/admin"),
  getMemberMeetings: () => api.get("/meetings/mine"),
  update: (id, d) => api.patch(`/meetings/${id}`, d),
  cancel: (id) => api.delete(`/meetings/${id}`),
  join: (id) => api.post(`/meetings/${id}/join`),
  sendReminders: () => api.post("/meetings/reminders/send"),
};

// Notifications
export const notificationService = {
  getAll: (params) => api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// ── Enterprise: Announcements ─────────────────────────────────────────────────
export const announcementService = {
  // Admin
  create: (d) => api.post("/announcements", d),
  update: (id, d) => api.patch(`/announcements/${id}`, d),
  remove: (id) => api.delete(`/announcements/${id}`),
  togglePin: (id) => api.patch(`/announcements/${id}/pin`),
  getAdminAll: (params) => api.get("/announcements/admin", { params }),
  getStats: (id) => api.get(`/announcements/${id}/stats`),
  // Member + Admin
  getAll: (params) => api.get("/announcements", { params }),
  markRead: (id) => api.patch(`/announcements/${id}/read`),
};

// ── Enterprise: Knowledge Base ────────────────────────────────────────────────
export const kbService = {
  upload: (formData) => api.post("/kb", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, d) => api.patch(`/kb/${id}`, d),
  remove: (id) => api.delete(`/kb/${id}`),
  list: (params) => api.get("/kb", { params }),
  get: (id) => api.get(`/kb/${id}`),
  trackDownload: (id) => api.post(`/kb/${id}/download`),
};

// ── Enterprise: Tasks ─────────────────────────────────────────────────────────
export const taskService = {
  // Admin
  create: (d) => api.post("/tasks", d),
  update: (id, d) => api.patch(`/tasks/${id}`, d),
  remove: (id) => api.delete(`/tasks/${id}`),
  getAll: (params) => api.get("/tasks/all", { params }),
  // Member
  getMine: (params) => api.get("/tasks/mine", { params }),
  updateMine: (id, d) => api.patch(`/tasks/${id}/update`, d),
  markRead: (id) => api.patch(`/tasks/${id}/read`),
};

// ── Enterprise: Leadership Corner ─────────────────────────────────────────────
export const leadershipService = {
  // Admin
  create: (formData) => api.post("/leadership", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, formData) => api.patch(`/leadership/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  remove: (id) => api.delete(`/leadership/${id}`),
  togglePin: (id) => api.patch(`/leadership/${id}/pin`),
  getStats: (id) => api.get(`/leadership/${id}/stats`),
  // Both
  list: (params) => api.get("/leadership", { params }),
  get: (id) => api.get(`/leadership/${id}`),
  acknowledge: (id) => api.patch(`/leadership/${id}/acknowledge`),
};

// ── Enterprise: Polls ─────────────────────────────────────────────────────────
export const pollService = {
  // Admin
  create: (d) => api.post("/polls", d),
  getAdminAll: (params) => api.get("/polls/admin", { params }),
  close: (id) => api.patch(`/polls/${id}/close`),
  remove: (id) => api.delete(`/polls/${id}`),
  getStats: (id) => api.get(`/polls/${id}/stats`),
  // Both
  getAll: (params) => api.get("/polls", { params }),
  vote: (id, optionIndex) => api.post(`/polls/${id}/vote`, { optionIndex }),
};

// ── Enterprise: Private Chat ───────────────────────────────────────────────────
export const privateMessageService = {
  getUsers: () => api.get("/private-messages/users"),
  getMessages: (userId) => api.get(`/private-messages/${userId}`),
  send: (userId, formData) => api.post(`/private-messages/${userId}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  markRead: (userId) => api.put(`/private-messages/${userId}/read`),
};

// ── Enterprise: Calls ─────────────────────────────────────────────────────────
export const callService = {
  getHistory: () => api.get("/call-history"),
};
