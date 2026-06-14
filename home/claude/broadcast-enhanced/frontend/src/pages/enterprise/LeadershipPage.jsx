/**
 * LeadershipPage — CEO / Leadership Corner
 * Admin: create, edit, delete, pin posts
 * Member: read posts, acknowledge, view pinned first
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import { leadershipService } from "../../services/api";
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

const POST_TYPE_CONFIG = {
  ceo_message:       { label: "CEO Message",        icon: "👔", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  company_vision:    { label: "Company Vision",     icon: "🎯", color: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" },
  goals:             { label: "Goals & Strategy",   icon: "📈", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  leadership_update: { label: "Leadership Update",  icon: "📣", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  general:           { label: "General",            icon: "💬", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

// ── Stats Modal (Admin) ───────────────────────────────────────────────────────
const PostStatsModal = ({ postId, onClose }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    leadershipService.getStats(postId).then(({ data }) => setStats(data)).catch(() => toast.error("Failed to load stats."));
  }, [postId]);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-md w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Post Analytics</h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">
          {!stats ? <div className="flex justify-center py-8"><Spinner/></div> : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{stats.title}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="card-p text-center">
                  <p className="text-xl font-bold text-brand-600">{stats.viewCount}</p>
                  <p className="section-title mt-1">Views</p>
                </div>
                <div className="card-p text-center">
                  <p className="text-xl font-bold text-emerald-600">{stats.ackCount}</p>
                  <p className="section-title mt-1">Acked</p>
                </div>
                <div className="card-p text-center">
                  <p className="text-xl font-bold text-slate-400">{stats.totalMembers}</p>
                  <p className="section-title mt-1">Members</p>
                </div>
              </div>
              {stats.ackCount > 0 && stats.totalMembers > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Acknowledgement rate</span>
                    <span>{Math.round((stats.ackCount / stats.totalMembers) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-2 bg-emerald-500 rounded-full"
                      style={{ width: `${(stats.ackCount / stats.totalMembers) * 100}%` }}/>
                  </div>
                </div>
              )}
              {stats.acknowledgements?.length > 0 && (
                <div>
                  <p className="section-title mb-2">Acknowledged by</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {stats.acknowledgements.map((a, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{a.userId?.name || "—"}</span>
                        <span className="text-xs text-slate-400">{a.acknowledgedAt ? formatDistanceToNow(new Date(a.acknowledgedAt), { addSuffix: true }) : ""}</span>
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

// ── Create / Edit Modal (Admin) ───────────────────────────────────────────────
const PostModal = ({ initial, onClose, onSaved }) => {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: initial?.title || "",
    content: initial?.content || "",
    postType: initial?.postType || "general",
    authorLabel: initial?.authorLabel || "",
    isPinned: initial?.isPinned || false,
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return toast.error("Title and content are required.");
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append("featuredImage", image);

      if (isEdit) {
        const { data } = await leadershipService.update(initial._id, fd);
        onSaved(data.post, "update");
        toast.success("Post updated.");
      } else {
        const { data } = await leadershipService.create(fd);
        onSaved(data.post, "create");
        toast.success("Post published.");
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
            {isEdit ? "Edit Post" : "New Leadership Post"}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Post type</label>
              <select value={form.postType} onChange={(e) => set("postType", e.target.value)} className="input">
                {Object.entries(POST_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Author label (optional)</label>
              <input type="text" value={form.authorLabel} onChange={(e) => set("authorLabel", e.target.value)}
                className="input" placeholder="e.g. Jane Smith, CEO" maxLength={100}/>
            </div>
          </div>
          <div>
            <label className="label">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="input" placeholder="Post title…" maxLength={200}/>
          </div>
          <div>
            <label className="label">Content *</label>
            <textarea value={form.content} onChange={(e) => set("content", e.target.value)}
              className="input resize-none" rows={8} placeholder="Write your message…" maxLength={10000}/>
            <p className="text-right text-xs text-slate-400 mt-1">{form.content.length}/10000</p>
          </div>
          <div>
            <label className="label">Featured image (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium hover:file:bg-brand-100"/>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={(e) => set("isPinned", e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"/>
            <span className="text-sm text-slate-700 dark:text-slate-300">Pin this post to the top</span>
          </label>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Saving…</> : isEdit ? "Save changes" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Leadership Post Card ──────────────────────────────────────────────────────
const PostCard = ({ post, isAdmin, onEdit, onDelete, onPin, onStats, onAcknowledge }) => {
  const [expanded, setExpanded] = useState(false);
  const [acking, setAcking] = useState(false);
  const [hasAcked, setHasAcked] = useState(post.hasAcknowledged || false);
  const cfg = POST_TYPE_CONFIG[post.postType] || POST_TYPE_CONFIG.general;

  const handleAck = async () => {
    if (hasAcked) return;
    setAcking(true);
    try {
      await leadershipService.acknowledge(post._id);
      setHasAcked(true);
      toast.success("Acknowledged!");
      onAcknowledge?.(post._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to acknowledge.");
    } finally { setAcking(false); }
  };

  return (
    <article className="card overflow-hidden animate-slide-up">
      {/* Featured image */}
      {post.featuredImage?.url && (
        <div className="h-40 overflow-hidden">
          <img src={`${API_BASE}${post.featuredImage.url}`} alt={post.title}
            className="w-full h-full object-cover"/>
        </div>
      )}

      <div className="p-5">
        {/* Meta row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
            {post.isPinned && <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">📌 Pinned</span>}
          </div>
          {isAdmin && (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onStats(post._id)} className="btn-ghost btn-sm" title="Stats">📊</button>
              <button onClick={() => onPin(post._id)} className="btn-ghost btn-sm" title={post.isPinned ? "Unpin" : "Pin"}>📌</button>
              <button onClick={() => onEdit(post)} className="btn-ghost btn-sm" title="Edit">✏️</button>
              <button onClick={() => onDelete(post._id)} className="btn-danger btn-sm" title="Delete">🗑</button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-1">{post.title}</h3>

        {/* Author + date */}
        <p className="text-xs text-slate-400 mb-3">
          {post.authorLabel || post.createdBy?.name}
          {" · "}
          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
        </p>

        {/* Content */}
        <div className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line ${!expanded ? "line-clamp-4" : ""}`}>
          {post.content}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button onClick={() => setExpanded((p) => !p)}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
            {expanded ? "Show less" : "Read full post"}
          </button>
          {!isAdmin && (
            <button onClick={handleAck} disabled={hasAcked || acking}
              className={`btn-sm transition-all ${
                hasAcked
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 cursor-default"
                  : "btn-secondary"
              }`}>
              {acking ? <Spinner/> : hasAcked ? "✓ Acknowledged" : "Acknowledge"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadershipPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [statsId, setStatsId] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPosts = useCallback(async (p = 1, reset = true) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 10 };
      if (typeFilter) params.postType = typeFilter;
      const { data } = await leadershipService.list(params);
      setPosts(reset ? data.posts : (prev) => [...prev, ...data.posts]);
      setTotalPages(data.pages);
      setPage(data.page);
    } catch { toast.error("Failed to load posts."); }
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { fetchPosts(1, true); }, [fetchPosts]);

  // Real-time: new leadership post
  useEffect(() => {
    if (!socket || isAdmin) return;
    const handler = ({ title, postType }) => {
      const cfg = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.general;
      toast(`${cfg.icon} ${cfg.label}: ${title}`, { duration: 7000 });
      fetchPosts(1, true);
    };
    socket.on("new_leadership_post", handler);
    return () => socket.off("new_leadership_post", handler);
  }, [socket, isAdmin, fetchPosts]);

  const handleSaved = (saved, action) => {
    if (action === "create") setPosts((p) => [saved, ...p]);
    else setPosts((p) => p.map((x) => x._id === saved._id ? saved : x));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await leadershipService.remove(id);
      setPosts((p) => p.filter((x) => x._id !== id));
      toast.success("Post deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  const handlePin = async (id) => {
    try {
      const { data } = await leadershipService.togglePin(id);
      setPosts((p) => p.map((x) => x._id === id ? { ...x, isPinned: data.isPinned } : x));
      toast.success(data.isPinned ? "Pinned." : "Unpinned.");
    } catch { toast.error("Failed."); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar/>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leadership Corner</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm pl-10">
              {isAdmin ? "Publish leadership updates and CEO messages." : "Messages and vision from company leadership."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              New Post
            </button>
          )}
        </div>

        {/* Post type filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          <button onClick={() => setTypeFilter("")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
              typeFilter === "" ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
            }`}>
            All
          </button>
          {Object.entries(POST_TYPE_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
                typeFilter === k ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
              }`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Spinner/> Loading…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No posts yet.</p>
            {isAdmin && <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Create first post</button>}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} isAdmin={isAdmin}
                onEdit={(item) => { setEditItem(item); setShowModal(true); }}
                onDelete={handleDelete} onPin={handlePin}
                onStats={setStatsId} onAcknowledge={() => {}}/>
            ))}
            {page < totalPages && (
              <div className="text-center pt-2">
                <button onClick={() => fetchPosts(page + 1, false)} disabled={loading} className="btn-secondary btn-sm">
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <PostModal initial={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} onSaved={handleSaved}/>
      )}
      {statsId && <PostStatsModal postId={statsId} onClose={() => setStatsId(null)}/>}
    </div>
  );
}
