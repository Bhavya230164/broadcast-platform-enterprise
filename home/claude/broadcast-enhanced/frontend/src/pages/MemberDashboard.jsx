/**
 * MemberDashboard — Enhanced
 * Features: inbox with priority/pin filters, read receipts, "I Have Read" ack,
 *           file attachments, pinned messages panel, meetings with Join button,
 *           real-time socket: new_message, meeting_scheduled, meeting_reminder,
 *           online/offline status display, notification panel
 */
import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import Navbar from "../components/layout/Navbar";
import { messageService, meetingService, notificationService } from "../services/api";
import { useSocket } from "../context/SocketContext";
import useAuthStore from "../store/useAuthStore";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

// ── Priority badge ─────────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  if (priority === "urgent") return <span className="badge-urgent">🚨 Urgent</span>;
  if (priority === "important") return <span className="badge-important">⚠️ Important</span>;
  return null;
};

// ── Attachment display ─────────────────────────────────────────────────────────
const AttachmentDisplay = ({ attachments }) => {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {attachments.map((a, i) => {
        const isImage = a.fileType === "image";
        if (isImage) {
          return (
            <a key={i} href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity">
              <img src={`${API_BASE}${a.url}`} alt={a.originalName}
                className="h-28 w-40 object-cover"/>
            </a>
          );
        }
        return (
          <a key={i} href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
            {a.fileType === "pdf" ? "📄" : "📎"}
            <span className="max-w-[160px] truncate">{a.originalName}</span>
            <span className="text-slate-400 ml-1">↓</span>
          </a>
        );
      })}
    </div>
  );
};

// ── Single message card ────────────────────────────────────────────────────────
const MessageCard = ({ message, isNew, onAcknowledge }) => {
  const [acking, setAcking] = useState(false);

  const handleAck = async () => {
    setAcking(true);
    try {
      await messageService.acknowledge(message._id);
      toast.success("Acknowledged!");
      onAcknowledge(message._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to acknowledge.");
    } finally { setAcking(false); }
  };

  const borderColor = message.priority === "urgent" ? "border-l-red-500"
    : message.priority === "important" ? "border-l-amber-500"
    : "border-l-transparent";

  return (
    <div className={`card p-4 border-l-4 ${borderColor} animate-slide-up transition-all hover:shadow-sm ${
      isNew ? "ring-1 ring-brand-300 dark:ring-brand-700" : ""
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={message.type === "broadcast" ? "badge-broadcast" : "badge-selective"}>
            {message.type === "broadcast" ? "📢 Broadcast" : "✉️ Direct"}
          </span>
          <PriorityBadge priority={message.priority}/>
          {message.isPinned && (
            <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">📌 Pinned</span>
          )}
          {isNew && (
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 animate-pulse">New</span>
          )}
          <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 text-[10px]">
            {message.groupName}
          </span>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Content */}
      {message.content && (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{message.content}</p>
      )}

      {/* Attachments */}
      <AttachmentDisplay attachments={message.attachments}/>

      {/* Footer: status + ack button */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {message.deliveredAt && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              Delivered
            </span>
          )}
          {message.readAt && (
            <span className="flex items-center gap-1 text-brand-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 13l4 4L19 7"/></svg>
              Read
            </span>
          )}
          {message.acknowledgedAt && (
            <span className="flex items-center gap-1 text-emerald-500">✅ Acknowledged</span>
          )}
        </div>

        {/* "I Have Read" button — only show if not yet acknowledged */}
        {!message.acknowledgedAt && (
          <button onClick={handleAck} disabled={acking}
            className="btn-secondary btn-sm text-xs">
            {acking ? <Spinner/> : "✓ I Have Read"}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Meeting card ───────────────────────────────────────────────────────────────
const MeetingCard = ({ meeting, onJoin }) => {
  const isUpcoming = !isPast(new Date(meeting.scheduledAt));
  const platformIcon = meeting.platform === "google_meet" ? "🎥" : meeting.platform === "zoom" ? "💻" : "📹";

  return (
    <div className={`card p-4 animate-fade-in ${isUpcoming ? "border-brand-200 dark:border-brand-800" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base">{platformIcon}</span>
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{meeting.title}</h4>
            {meeting.hasJoined && (
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Joined</span>
            )}
          </div>
          {meeting.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{meeting.description}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            📅 {format(new Date(meeting.scheduledAt), "MMM d, yyyy · h:mm a")}
            <span className="ml-2 text-slate-400">· {meeting.durationMinutes} min</span>
          </p>
          {meeting.groupName && (
            <p className="text-xs text-slate-400 mt-0.5">Group: {meeting.groupName}</p>
          )}
        </div>

        {/* Join button */}
        {meeting.meetingLink && isUpcoming && (
          <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer"
            onClick={() => onJoin(meeting._id)}
            className="btn-primary btn-sm flex-shrink-0 no-underline">
            Join
          </a>
        )}
        {!meeting.meetingLink && (
          <span className="text-xs text-slate-400 italic flex-shrink-0">No link</span>
        )}
      </div>
      {!isUpcoming && (
        <p className="text-xs text-slate-400 mt-2 italic">
          Ended {formatDistanceToNow(new Date(meeting.scheduledAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
};

// ── Main MemberDashboard ───────────────────────────────────────────────────────
export default function MemberDashboard() {
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const newIdTimers = useRef({});

  // Mark a message ID as "new" for 8s
  const markAsNew = useCallback((id) => {
    setNewIds((p) => new Set([...p, id]));
    clearTimeout(newIdTimers.current[id]);
    newIdTimers.current[id] = setTimeout(() => {
      setNewIds((p) => { const n = new Set(p); n.delete(id); return n; });
    }, 8000);
  }, []);

  useEffect(() => () => Object.values(newIdTimers.current).forEach(clearTimeout), []);

  const fetchMessages = useCallback(async (page = 1, replace = true) => {
    if (page === 1) setLoadingMessages(true); else setLoadingMore(true);
    try {
      const params = { page, limit: 20 };
      if (priorityFilter !== "all") params.priority = priorityFilter;
      const { data } = await messageService.getInbox(params);
      setMessages((p) => replace ? data.messages : [...p, ...data.messages]);
      setPagination({ page: data.page, pages: data.pages, total: data.total });
    } catch { toast.error("Failed to load inbox."); }
    finally { setLoadingMessages(false); setLoadingMore(false); }
  }, [priorityFilter]);

  const fetchPinned = useCallback(async () => {
    try {
      const { data } = await messageService.getPinned();
      setPinnedMessages(data.messages);
    } catch {}
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await meetingService.getMemberMeetings();
      setMeetings(data.meetings);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationService.getAll({ limit: 20 });
      setNotifications(data.notifications);
    } catch {}
  }, []);

  useEffect(() => {
    fetchMessages(1, true);
    fetchPinned();
    fetchMeetings();
    fetchNotifications();
  }, [fetchMessages, fetchPinned, fetchMeetings, fetchNotifications]);

  // Re-fetch when filter changes
  useEffect(() => { fetchMessages(1, true); }, [priorityFilter, fetchMessages]);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // New message from admin
    const handleNewMessage = (msg) => {
      const shaped = {
        _id: msg._id, content: msg.content, type: msg.type,
        priority: msg.priority, isPinned: false,
        groupName: msg.groupName, groupId: msg.groupId,
        attachments: msg.attachments || [],
        deliveredAt: new Date(), readAt: null, acknowledgedAt: null,
        createdAt: msg.createdAt,
      };
      setMessages((p) => [shaped, ...p]);
      setPagination((p) => ({ ...p, total: p.total + 1 }));
      markAsNew(msg._id);

      // Toast with priority-aware styling
      const icon = msg.priority === "urgent" ? "🚨" : msg.priority === "important" ? "⚠️" : "📡";
      toast(
        (t) => (
          <div>
            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white text-sm">
              {icon} New {msg.priority !== "normal" ? msg.priority + " " : ""}message
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{msg.groupName}</div>
            <div className="text-sm text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
              {msg.content || (msg.attachments?.length ? `${msg.attachments.length} attachment(s)` : "")}
            </div>
          </div>
        ),
        { duration: msg.priority === "urgent" ? 10000 : 6000 }
      );
    };

    // Message pinned
    const handlePinned = ({ messageId }) => {
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, isPinned: true } : m));
      fetchPinned();
      toast("📌 A message was pinned.", { icon: "📌" });
    };

    // Meeting scheduled
    const handleMeetingScheduled = (data) => {
      fetchMeetings();
      toast(`📅 Meeting scheduled: ${data.title}`, { duration: 7000 });
    };

    // Meeting cancelled
    const handleMeetingCancelled = ({ title }) => {
      fetchMeetings();
      toast.error(`Meeting cancelled: ${title}`);
    };

    // Meeting reminder
    const handleMeetingReminder = ({ title, minutesBefore, meetingLink }) => {
      toast(
        (t) => (
          <div>
            <div className="font-medium text-sm">⏰ Meeting in {minutesBefore} minutes</div>
            <div className="text-xs text-slate-500 mt-0.5">{title}</div>
            {meetingLink && (
              <a href={meetingLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-500 hover:underline mt-1 block">Join now →</a>
            )}
          </div>
        ),
        { duration: 12000 }
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_pinned", handlePinned);
    socket.on("meeting_scheduled", handleMeetingScheduled);
    socket.on("meeting_cancelled", handleMeetingCancelled);
    socket.on("meeting_reminder", handleMeetingReminder);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_pinned", handlePinned);
      socket.off("meeting_scheduled", handleMeetingScheduled);
      socket.off("meeting_cancelled", handleMeetingCancelled);
      socket.off("meeting_reminder", handleMeetingReminder);
    };
  }, [socket, fetchPinned, fetchMeetings, markAsNew]);

  const handleAcknowledge = (messageId) => {
    setMessages((p) => p.map((m) => m._id === messageId ? { ...m, acknowledgedAt: new Date() } : m));
  };

  const handleJoinMeeting = async (meetingId) => {
    try {
      await meetingService.join(meetingId);
      setMeetings((p) => p.map((m) => m._id === meetingId ? { ...m, hasJoined: true } : m));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
      toast.success("All read.");
    } catch {}
  };

  const upcomingMeetings = meetings.filter((m) => !isPast(new Date(m.scheduledAt)));
  const pastMeetings = meetings.filter((m) => isPast(new Date(m.scheduledAt)));
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />


      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good day, {user?.name?.split(" ")[0]}.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-400"}`}/>
            {isConnected ? "Connected — messages arrive in real-time" : "Offline — reconnecting…"}
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Messages", value: pagination.total },
            { label: "Pinned", value: pinnedMessages.length },
            { label: "Meetings", value: upcomingMeetings.length },
            { label: "Unread notifs", value: unreadNotifCount },
          ].map((s) => (
            <div key={s.label} className="card-p text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="section-title mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
          {["inbox", "pinned", "meetings", "notifications"].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === t ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}>
              {t}
              {t === "notifications" && unreadNotifCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{unreadNotifCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Inbox tab ── */}
        {activeTab === "inbox" && (
          <div>
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <p className="section-title">Filter:</p>
              {["all", "urgent", "important", "normal"].map((f) => (
                <button key={f} onClick={() => setPriorityFilter(f)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border capitalize transition-all ${
                    priorityFilter === f
                      ? f === "urgent" ? "bg-red-500 text-white border-red-500"
                        : f === "important" ? "bg-amber-500 text-white border-amber-500"
                        : "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-800"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>

            {loadingMessages ? (
              <div className="text-center py-16 text-slate-400 text-sm flex items-center justify-center gap-2">
                <Spinner/> Loading inbox…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                  </svg>
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Inbox is empty</p>
                <p className="text-slate-400 text-sm mt-1">Messages from the Admin appear here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <MessageCard key={m._id} message={m} isNew={newIds.has(m._id)} onAcknowledge={handleAcknowledge}/>
                ))}
                {pagination.page < pagination.pages && (
                  <div className="text-center pt-2">
                    <button onClick={() => fetchMessages(pagination.page + 1, false)} disabled={loadingMore}
                      className="btn-secondary btn-sm">
                      {loadingMore ? <><Spinner/> Loading…</> : "Load older messages"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Pinned tab ── */}
        {activeTab === "pinned" && (
          <div className="space-y-3">
            {pinnedMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                <div className="text-4xl mb-3">📌</div>
                No pinned messages yet.
              </div>
            ) : pinnedMessages.map((m) => (
              <MessageCard key={m._id} message={m} isNew={false} onAcknowledge={handleAcknowledge}/>
            ))}
          </div>
        )}

        {/* ── Meetings tab ── */}
        {activeTab === "meetings" && (
          <div className="space-y-6">
            {upcomingMeetings.length > 0 && (
              <div>
                <p className="section-title mb-3">Upcoming</p>
                <div className="space-y-3">
                  {upcomingMeetings.map((m) => (
                    <MeetingCard key={m._id} meeting={m} onJoin={handleJoinMeeting}/>
                  ))}
                </div>
              </div>
            )}
            {pastMeetings.length > 0 && (
              <div>
                <p className="section-title mb-3">Past</p>
                <div className="space-y-3">
                  {pastMeetings.map((m) => (
                    <MeetingCard key={m._id} meeting={m} onJoin={handleJoinMeeting}/>
                  ))}
                </div>
              </div>
            )}
            {meetings.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm">
                <div className="text-4xl mb-3">📅</div>
                No meetings scheduled for you yet.
              </div>
            )}
          </div>
        )}

        {/* ── Notifications tab ── */}
        {activeTab === "notifications" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">{unreadNotifCount} unread</p>
              {unreadNotifCount > 0 && (
                <button onClick={handleMarkAllRead} className="btn-ghost btn-sm">Mark all read</button>
              )}
            </div>
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  <div className="text-4xl mb-3">🔔</div>
                  No notifications yet.
                </div>
              ) : notifications.map((n) => (
                <div key={n._id}
                  className={`card p-4 flex items-start gap-3 animate-fade-in ${
                    !n.isRead ? "border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10" : ""
                  }`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? "bg-brand-500" : "bg-transparent"}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</p>}
                    {n.metadata?.meetingLink && (
                      <a href={n.metadata.meetingLink} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-500 hover:underline mt-1 block">Join meeting →</a>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button onClick={async () => {
                    await notificationService.markRead(n._id);
                    setNotifications((p) => p.map((x) => x._id === n._id ? { ...x, isRead: true } : x));
                  }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                    ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
    
  );
}
