/**
 * AnnouncementsPage — Announcement Center
 * Admin view: create, edit, delete, pin, view read stats
 * Member view: read list, mark as read, pinned first
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import { announcementService } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";
import { useSocket } from "../../context/SocketContext";
import { formatDistanceToNow, format } from "date-fns";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const PriorityBadge = ({ priority }) => {
  const map = {
    urgent: "badge-urgent",
    important: "badge-important",
    normal: "badge-normal",
  };
  const icons = { urgent: "🚨", important: "⚠️", normal: "📢" };
  return <span className={map[priority]}>{icons[priority]} {priority}</span>;
};

// ── Create / Edit Modal ────────────────────────────────────────────────────────
const AnnouncementModal = ({ initial, onClose, onSaved }) => {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: initial?.title || "",
    content: initial?.content || "",
    priority: initial?.priority || "normal",
    isPinned: initial?.isPinned || false,
    scheduledAt: initial?.scheduledAt ? new Date(initial.scheduledAt).toISOString().slice(0,16) : "",
    expiresAt: initial?.expiresAt ? new Date(initial.expiresAt).toISOString().slice(0,16) : "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return toast.error("Title and content are required.");
    setLoading(true);
    try {
      const payload = {
        ...form,
        scheduledAt: form.scheduledAt || null,
        expiresAt: form.expiresAt || null,
      };
      if (isEdit) {
        const { data } = await announcementService.update(initial._id, payload);
        onSaved(data.announcement, "update");
        toast.success("Announcement updated.");
      } else {
        const { data } = await announcementService.create(payload);
        onSaved(data.announcement, "create");
        toast.success("Announcement created.");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {isEdit ? "Edit Announcement" : "New Announcement"}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="input" placeholder="Announcement title…" maxLength={160}/>
          </div>
          <div>
            <label className="label">Content *</label>
            <textarea value={form.content} onChange={(e) => set("content", e.target.value)}
              className="input resize-none" rows={6} placeholder="Write your announcement…" maxLength={5000}/>
            <p className="text-right text-xs text-slate-400 mt-1">{form.content.length}/5000</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Priority</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="input">
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Schedule (optional)</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="input"/>
            </div>
            <div>
              <label className="label">Expires (optional)</label>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="input"/>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={(e) => set("isPinned", e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"/>
            <span className="text-sm text-slate-700 dark:text-slate-300">Pin this announcement</span>
          </label>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? <Spinner/> : isEdit ? "Save changes" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Stats Modal ───────────────────────────────────────────────────────────────
const StatsModal = ({ announcementId, onClose }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    announcementService.getStats(announcementId).then(({ data }) => setStats(data)).catch(() => toast.error("Failed to load stats."));
  }, [announcementId]);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-md w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Read Receipt Stats</h3>
          <button onClick={onClose} className="btn-ghost btn-icon"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="modal-body">
          {!stats ? <div className="flex justify-center py-8"><Spinner/></div> : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{stats.title}</p>
              <div className="flex gap-4">
                <div className="flex-1 card-p text-center">
                  <p className="text-2xl font-bold text-brand-600">{stats.readCount}</p>
                  <p className="section-title mt-1">Read</p>
                </div>
                <div className="flex-1 card-p text-center">
                  <p className="text-2xl font-bold text-slate-400">{stats.totalMembers - stats.readCount}</p>
                  <p className="section-title mt-1">Unread</p>
                </div>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Read rate</span>
                  <span>{stats.totalMembers > 0 ? Math.round((stats.readCount / stats.totalMembers) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-2 bg-brand-500 rounded-full transition-all"
                    style={{ width: `${stats.totalMembers > 0 ? (stats.readCount / stats.totalMembers) * 100 : 0}%` }}/>
                </div>
              </div>
              {stats.readers.length > 0 && (
                <div>
                  <p className="section-title mb-2">Read by</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {stats.readers.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{r.userId?.name || "—"}</span>
                        <span className="text-xs text-slate-400">{r.readAt ? formatDistanceToNow(new Date(r.readAt), { addSuffix: true }) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer"><button onClick={onClose} className="btn-secondary">Close</button></div>
      </div>
    </div>
  );
};

// ── Announcement Card ─────────────────────────────────────────────────────────
const AnnouncementCard = ({ announcement, isAdmin, onEdit, onDelete, onPin, onStats, onRead }) => {
  const [expanded, setExpanded] = useState(false);
  const isScheduled = announcement.scheduledAt && new Date(announcement.scheduledAt) > new Date();
  const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < new Date();

  const borderColor = announcement.priority === "urgent" ? "border-l-red-500"
    : announcement.priority === "important" ? "border-l-amber-500" : "border-l-transparent";

  return (
    <div className={`card border-l-4 ${borderColor} overflow-hidden animate-slide-up`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <PriorityBadge priority={announcement.priority}/>
              {announcement.isPinned && <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">📌 Pinned</span>}
              {isScheduled && <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🕐 Scheduled</span>}
              {isExpired && <span className="badge bg-slate-100 text-slate-500">⏰ Expired</span>}
              {!isAdmin && announcement.hasRead && <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">✓ Read</span>}
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white leading-snug">{announcement.title}</h3>
            <p className="text-xs text-slate-400 mt-1">
              By {announcement.createdBy?.name} · {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onStats(announcement._id)} className="btn-ghost btn-sm" title="Stats">📊</button>
              <button onClick={() => onPin(announcement._id)} className="btn-ghost btn-sm" title={announcement.isPinned ? "Unpin" : "Pin"}>📌</button>
              <button onClick={() => onEdit(announcement)} className="btn-ghost btn-sm" title="Edit">✏️</button>
              <button onClick={() => onDelete(announcement._id)} className="btn-danger btn-sm" title="Delete">🗑</button>
            </div>
          )}
        </div>

        {/* Content — truncated by default */}
        <div className={`mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
          {announcement.content}
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => {
            setExpanded((p) => !p);
            if (!isAdmin && !announcement.hasRead) onRead(announcement._id);
          }} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
            {expanded ? "Show less" : "Read more"}
          </button>
          {!isAdmin && !announcement.hasRead && (
            <button onClick={() => onRead(announcement._id)} className="btn-secondary btn-sm">
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [statsId, setStatsId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAnnouncements = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const fetchFn = isAdmin ? announcementService.getAdminAll : announcementService.getAll;
      const { data } = await fetchFn({ page: p, limit: 20 });
      setAnnouncements(p === 1 ? data.announcements : (prev) => [...prev, ...data.announcements]);
      setTotalPages(data.pages);
      setPage(data.page);
    } catch { toast.error("Failed to load announcements."); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { fetchAnnouncements(1); }, [fetchAnnouncements]);

  // Real-time: new announcement from socket
  useEffect(() => {
    if (!socket || isAdmin) return;
    const handler = () => fetchAnnouncements(1);
    socket.on("new_announcement", handler);
    return () => socket.off("new_announcement", handler);
  }, [socket, isAdmin, fetchAnnouncements]);

  const handleSaved = (saved, action) => {
    if (action === "create") setAnnouncements((p) => [saved, ...p]);
    else setAnnouncements((p) => p.map((a) => a._id === saved._id ? saved : a));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await announcementService.remove(id);
      setAnnouncements((p) => p.filter((a) => a._id !== id));
      toast.success("Deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  const handlePin = async (id) => {
    try {
      const { data } = await announcementService.togglePin(id);
      setAnnouncements((p) => p.map((a) => a._id === id ? { ...a, isPinned: data.isPinned } : a));
      toast.success(data.message);
    } catch { toast.error("Failed."); }
  };

  const handleRead = async (id) => {
    try {
      await announcementService.markRead(id);
      setAnnouncements((p) => p.map((a) => a._id === id ? { ...a, hasRead: true } : a));
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar/>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 pb-24">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcement Center</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm pl-10">
              {isAdmin ? "Create and manage company announcements." : "Company announcements from your admin."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Announcement
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Spinner/> Loading…</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📢</div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No announcements yet.</p>
            {isAdmin && <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Create first announcement</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <AnnouncementCard key={a._id} announcement={a} isAdmin={isAdmin}
                onEdit={(item) => { setEditItem(item); setShowModal(true); }}
                onDelete={handleDelete} onPin={handlePin}
                onStats={setStatsId} onRead={handleRead}/>
            ))}
            {page < totalPages && (
              <div className="text-center pt-2">
                <button onClick={() => fetchAnnouncements(page + 1)} className="btn-secondary btn-sm">Load more</button>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <AnnouncementModal initial={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} onSaved={handleSaved}/>
      )}
      {statsId && <StatsModal announcementId={statsId} onClose={() => setStatsId(null)}/>}
    </div>
  );
}
