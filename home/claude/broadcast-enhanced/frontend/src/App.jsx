/**
 * App.jsx — Extended with 4 enterprise feature routes
 * All original routes are PRESERVED unchanged.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./store/useAuthStore";

// ── Existing pages (UNCHANGED) ────────────────────────────────────────────────
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminDashboard from "./pages/AdminDashboard";
import MemberDashboard from "./pages/MemberDashboard";
import ProfilePage from "./pages/ProfilePage";
import TwoFASetupPage from "./pages/TwoFASetupPage";

// ── New enterprise pages ──────────────────────────────────────────────────────
import AnnouncementsPage from "./pages/enterprise/AnnouncementsPage";
import KnowledgeBasePage from "./pages/enterprise/KnowledgeBasePage";
import TasksPage from "./pages/enterprise/TasksPage";
import LeadershipPage from "./pages/enterprise/LeadershipPage";
import PollsPage from "./pages/enterprise/PollsPage";
import PrivateChatPage from "./pages/enterprise/PrivateChatPage";

import CallOverlay from "./components/chat/CallOverlay";
import CallHistoryPage from "./pages/enterprise/CallHistoryPage";
import RealtimeNotifications from "./components/notifications/RealtimeNotifications";
import BottomNav from "./components/layout/BottomNav";
import MeetingsPage from "./pages/MeetingsPage";
import CalendarPage from "./pages/CalendarPage";

// ── Route guards ──────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole)
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
};

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to="/home" replace />;
};

const HomeRoute = () => {
  const { user } = useAuthStore();
  return user?.role === "admin" ? <AdminDashboard /> : <MemberDashboard initialTab="inbox" />;
};

export default function App() {
  return (
    <>
      <RealtimeNotifications />
      <CallOverlay />
      <BottomNav />
      <Routes>
        {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Existing protected */}
      <Route path="/home" element={<ProtectedRoute><HomeRoute /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requiredRole="member"><MemberDashboard initialTab="inbox" /></ProtectedRoute>} />
      <Route path="/chats" element={<ProtectedRoute><PrivateChatPage /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/2fa-setup" element={<ProtectedRoute><TwoFASetupPage /></ProtectedRoute>} />
      

      {/* Enterprise features — accessible by both roles (pages handle role logic internally) */}
      <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
      <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/leadership" element={<ProtectedRoute><LeadershipPage /></ProtectedRoute>} />
      <Route path="/polls" element={<ProtectedRoute><PollsPage /></ProtectedRoute>} />
      <Route path="/private-chat" element={<ProtectedRoute><PrivateChatPage /></ProtectedRoute>} />
      <Route path="/call-history" element={<ProtectedRoute><CallHistoryPage /></ProtectedRoute>} />

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
</>
  );
}
