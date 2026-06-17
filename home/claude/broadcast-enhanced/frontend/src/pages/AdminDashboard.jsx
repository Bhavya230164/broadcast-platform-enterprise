/**
 * AdminDashboard — Enhanced
 * Features: groups, members, message composer (priority + attachments + selective),
 *           message history with receipts, pin, meetings, real-time ack listener
 */
import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import Navbar from "../components/layout/Navbar";
import { groupService, messageService, meetingService, notificationService } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { format, formatDistanceToNow } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const PriorityBadge = ({ priority }) => {
  const map = { urgent: "badge-urgent", important: "badge-important", normal: "badge-normal" };
  return <span className={map[priority] || "badge-normal"}>{priority}</span>;
};

// ── File attachment preview item ───────────────────────────────────────────────
const AttachmentChip = ({ file, onRemove }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300">
    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
    </svg>
    <span className="max-w-[120px] truncate">{file.name}</span>
    {onRemove && (
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5">×</button>
    )}
  </div>
);

// ── Attachment display for sent messages ───────────────────────────────────────
const AttachmentDisplay = ({ attachments }) => {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((a, i) => (
        <a key={i} href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-lg text-xs text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors">
          {a.fileType === "image" ? "🖼" : a.fileType === "pdf" ? "📄" : "📎"}
          <span className="max-w-[140px] truncate">{a.originalName}</span>
        </a>
      ))}
    </div>
  );
};

// ── Message Composer Modal ─────────────────────────────────────────────────────
const MessageComposer = ({ group, onClose, onSent }) => {
  const [mode, setMode] = useState("broadcast");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [selectedIds, setSelectedIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const toggleReceiver = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (files.length + picked.length > 5) return toast.error("Maximum 5 attachments per message.");
    setFiles((p) => [...p, ...picked]);
  };

  const handleSend = async () => {
    if (!content.trim() && files.length === 0) return toast.error("Add a message or attachment.");
    if (mode === "selective" && selectedIds.length === 0) return toast.error("Select at least one recipient.");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("groupId", group._id);
      formData.append("content", content.trim());
      formData.append("type", mode);
      formData.append("priority", priority);
      if (mode === "selective") formData.append("receiverIds", JSON.stringify(selectedIds));
      files.forEach((f) => formData.append("attachments", f));

      const { data } = await messageService.send(formData);
      toast.success(data.message);
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Send Message</h3>
            <p className="text-xs text-slate-400 mt-0.5">To: {group.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        <div className="modal-body space-y-4">
          {/* Mode */}
          <div>
            <p className="section-title mb-2">Delivery mode</p>
            <div className="grid grid-cols-2 gap-2">
              {[["broadcast","Broadcast","All members"],["selective","Selective","Choose recipients"]].map(([k,l,d]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setSelectedIds([]); }}
                  className={`p-2.5 rounded-xl border text-sm text-left transition-all ${mode === k ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"}`}>
                  <p className="font-medium">{l}</p>
                  <p className="text-xs opacity-70 mt-0.5">{d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="section-title mb-2">Priority</p>
            <div className="flex gap-2">
              {["normal","important","urgent"].map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${priority === p
                    ? p === "urgent" ? "bg-red-500 text-white border-red-500"
                      : p === "important" ? "bg-amber-500 text-white border-amber-500"
                      : "bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-800"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Selective member picker */}
          {mode === "selective" && (
            <div>
              <p className="section-title mb-2">Recipients ({selectedIds.length}/{group.members?.length})</p>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 max-h-36 overflow-y-auto">
                {group.members?.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">No members in this group.</p>
                ) : group.members?.map((m) => {
                  const sel = selectedIds.includes(m._id);
                  return (
                    <button key={m._id} type="button" onClick={() => toggleReceiver(m._id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${sel ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${sel ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"}`}>
                        {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{m.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{m.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="label">Message</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              className="input resize-none" rows={4} placeholder="Type your message…" maxLength={2000}/>
            <p className="text-right text-xs text-slate-400 mt-1">{content.length}/2000</p>
          </div>

          {/* Attachments */}
          <div>
            <p className="section-title mb-2">Attachments ({files.length}/5)</p>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <AttachmentChip key={i} file={f} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))}/>
              ))}
              {files.length < 5 && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Add file
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFiles} className="hidden"/>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Images, PDF, Word, Excel. Max 10 MB each.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSend} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Sending…</> : mode === "broadcast" ? "Broadcast" : `Send to ${selectedIds.length || "—"}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Create Group Modal ─────────────────────────────────────────────────────────
const CreateGroupModal = ({ allMembers, onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = allMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Group name is required.");
    setLoading(true);
    try {
      const { data } = await groupService.create({ name: name.trim(), description: description.trim(), memberIds: selectedIds });
      toast.success(`Group "${data.group.name}" created.`);
      onCreated(data.group);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create group.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">New Group</h3>
          <button onClick={onClose} className="btn-ghost btn-icon"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Group name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Engineering Team"/>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input resize-none" rows={2} placeholder="Optional"/>
          </div>
          <div>
            <label className="label">Add members ({selectedIds.length} selected)</label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input mb-2" placeholder="Search…"/>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
              {filtered.map((m) => {
                const sel = selectedIds.includes(m._id);
                return (
                  <button key={m._id} type="button" onClick={() => toggle(m._id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${sel ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"}`}>
                      {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Creating…</> : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Schedule Meeting Modal ─────────────────────────────────────────────────────
const MeetingModal = ({ groups, onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: "", description: "", scheduledAt: "", durationMinutes: 60,
    groupId: "", meetingLink: "", reminders: [{ minutesBefore: 30 }, { minutesBefore: 5 }]
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.title || !form.scheduledAt || !form.groupId) return toast.error("Fill in required fields.");
    setLoading(true);
    try {
      const { data } = await meetingService.create(form);
      toast.success("Meeting scheduled!");
      onCreated(data.meeting);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create meeting.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Schedule Meeting</h3>
          <button onClick={onClose} className="btn-ghost btn-icon"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="Q4 Review"/>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input resize-none" rows={2}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date & Time *</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="input"/>
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" value={form.durationMinutes} onChange={(e) => set("durationMinutes", parseInt(e.target.value))} className="input" min={5} max={480}/>
            </div>
          </div>
          <div>
            <label className="label">Group *</label>
            <select value={form.groupId} onChange={(e) => set("groupId", e.target.value)} className="input">
              <option value="">Select group…</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Meeting link (Google Meet / Zoom)</label>
            <input type="url" value={form.meetingLink} onChange={(e) => set("meetingLink", e.target.value)} className="input" placeholder="https://meet.google.com/…"/>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            Reminders will be sent 30 min and 5 min before the meeting.
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Scheduling…</> : "Schedule Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Message History Panel ──────────────────────────────────────────────────────
const MessageHistory = ({ groupId, groupName }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data } = await messageService.getGroupMessages(groupId);
      setMessages(data.messages);
    } catch { toast.error("Failed to load messages."); }
    finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handlePin = async (id) => {
    try {
      const { data } = await messageService.togglePin(id);
      toast.success(data.message);
      setMessages((p) => p.map((m) => m._id === id ? { ...m, isPinned: data.isPinned } : m));
    } catch { toast.error("Failed to pin message."); }
  };

  if (loading) return <div className="flex items-center justify-center p-8 text-slate-400 text-sm"><Spinner/>&nbsp;Loading…</div>;
  if (!messages.length) return <div className="text-center p-8 text-slate-400 text-sm">No messages sent to this group yet.</div>;

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {messages.map((m) => (
        <div key={m._id} className={`card p-4 border-l-4 animate-fade-in ${
          m.priority === "urgent" ? "border-l-red-500" : m.priority === "important" ? "border-l-amber-500" : "border-l-transparent"
        }`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={m.type === "broadcast" ? "badge-broadcast" : "badge-selective"}>{m.type}</span>
              <PriorityBadge priority={m.priority}/>
              {m.isPinned && <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">📌 Pinned</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handlePin(m._id)} className="btn-ghost btn-icon text-xs p-1.5" title={m.isPinned ? "Unpin" : "Pin"}>
                📌
              </button>
              <span className="text-xs text-slate-400 whitespace-nowrap">{format(new Date(m.createdAt), "MMM d, HH:mm")}</span>
            </div>
          </div>
          {m.content && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{m.content}</p>}
          <AttachmentDisplay attachments={m.attachments}/>
          <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-400">
            <span>👥 {m.receiverCount} recipients</span>
            <span>👁 {m.readCount} read</span>
            <span>✅ {m.acknowledgedCount} acknowledged</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Group Card ─────────────────────────────────────────────────────────────────
const GroupCard = ({ group, allMembers, onMessage, onDelete, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addIds, setAddIds] = useState([]);
  const [addLoading, setAddLoading] = useState(false);

  const existingSet = new Set(group.members.map((m) => m._id));
  const available = allMembers.filter((m) => !existingSet.has(m._id) &&
    (m.name.toLowerCase().includes(addSearch.toLowerCase()) || m.email.toLowerCase().includes(addSearch.toLowerCase()))
  );

  const handleAddMembers = async () => {
    if (!addIds.length) return;
    setAddLoading(true);
    try {
      await groupService.addMembers(group._id, { memberIds: addIds });
      toast.success("Members added.");
      setAddIds([]);
      setAddSearch("");
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to add members."); }
    finally { setAddLoading(false); }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    try {
      await groupService.removeMember(group._id, memberId);
      toast.success(`${memberName} removed.`);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to remove."); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete group "${group.name}" and all its messages?`)) return;
    try {
      await groupService.delete(group._id);
      toast.success("Group deleted.");
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to delete."); }
  };

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{group.name}</h3>
            <span className="badge-normal">{group.members.length} member{group.members.length !== 1 ? "s" : ""}</span>
          </div>
          {group.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{group.description}</p>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => onMessage(group)} className="btn-primary btn-sm">Message</button>
          <button onClick={() => setExpanded((p) => !p)} className="btn-secondary btn-sm">{expanded ? "Less" : "Details"}</button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 space-y-4 animate-fade-in">
          {/* Members list */}
          <div>
            <p className="section-title mb-2">Members</p>
            {group.members.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet.</p>
            ) : (
              <div className="space-y-1.5">
                {group.members.map((m) => (
                  <div key={m._id} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{m.email}</span>
                    </div>
                    <button onClick={() => handleRemoveMember(m._id, m.name)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add members */}
          <div>
            <p className="section-title mb-2">Add members</p>
            <input type="text" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="input text-sm mb-2" placeholder="Search…"/>
            {available.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 max-h-36 overflow-y-auto mb-2">
                {available.map((m) => {
                  const sel = addIds.includes(m._id);
                  return (
                    <button key={m._id} type="button"
                      onClick={() => setAddIds((p) => sel ? p.filter((x) => x !== m._id) : [...p, m._id])}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${sel ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${sel ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"}`}/>
                      <span className="text-slate-700 dark:text-slate-300">{m.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{m.email}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {addIds.length > 0 && (
              <button onClick={handleAddMembers} disabled={addLoading} className="btn-primary btn-sm">
                {addLoading ? <Spinner/> : `Add ${addIds.length} selected`}
              </button>
            )}
          </div>

          {/* Message history toggle */}
          <div>
            <button onClick={() => setShowHistory((p) => !p)}
              className="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              {showHistory ? "Hide message history" : "View message history"}
            </button>
            {showHistory && <div className="mt-3"><MessageHistory groupId={group._id} groupName={group.name}/></div>}
          </div>

          <div className="pt-1">
            <button onClick={handleDelete} className="btn-danger btn-sm">Delete Group</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Meetings Panel ─────────────────────────────────────────────────────────────
const MeetingsPanel = ({ meetings, onCancel }) => {
  if (!meetings.length) return (
    <div className="text-center py-10 text-slate-400 text-sm">No meetings scheduled yet.</div>
  );
  return (
    <div className="space-y-3">
      {meetings.map((m) => (
        <div key={m._id} className="card p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{m.title}</h4>
                <span className={`badge text-[10px] ${
                  m.status === "cancelled" ? "bg-red-100 text-red-600" :
                  m.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                }`}>{m.status}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                📅 {format(new Date(m.scheduledAt), "MMM d, yyyy · h:mm a")} · {m.durationMinutes} min
              </p>
              {m.groupId && <p className="text-xs text-slate-400 mt-0.5">Group: {m.groupId.name}</p>}
              {m.meetingLink && (
                <a href={m.meetingLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1">
                  🔗 Join link
                </a>
              )}
            </div>
            {m.status === "scheduled" && (
              <button onClick={() => onCancel(m._id)} className="btn-danger btn-sm flex-shrink-0">Cancel</button>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            👥 {m.invitees?.length || 0} invitees · ✅ {m.joinedBy?.length || 0} joined
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main AdminDashboard ────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { socket } = useSocket();
  const [groups, setGroups] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [activeTab, setActiveTab] = useState("groups");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [composerGroup, setComposerGroup] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [gRes, mRes] = await Promise.all([groupService.getAll(), groupService.getUsers()]);
      setGroups(gRes.data.groups);
      setAllMembers(mRes.data.members);
    } catch { toast.error("Failed to load data."); }
    finally { setLoadingGroups(false); }
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await meetingService.getAdminMeetings();
      setMeetings(data.meetings);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationService.getAll({ limit: 20 });
      setNotifications(data.notifications);
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); fetchMeetings(); fetchNotifications(); }, [fetchAll, fetchMeetings, fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    const handleNotificationUpdated = () => fetchNotifications();
    socket.on("notification_updated", handleNotificationUpdated);
    return () => socket.off("notification_updated", handleNotificationUpdated);
  }, [socket, fetchNotifications]);

  // Real-time: listen for acknowledgements and new message receipts
  useEffect(() => {
    if (!socket) return;
    const handleAck = ({ messageId, userName, acknowledgedAt }) => {
      toast(`✅ ${userName} acknowledged a message`, { icon: "📩" });
    };
    socket.on("message_acknowledged", handleAck);
    return () => socket.off("message_acknowledged", handleAck);
  }, [socket]);

  const handleCancelMeeting = async (id) => {
    if (!window.confirm("Cancel this meeting?")) return;
    try {
      await meetingService.cancel(id);
      toast.success("Meeting cancelled.");
      fetchMeetings();
    } catch { toast.error("Failed to cancel meeting."); }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read.");
    } catch {}
  };

  const tabs = ["groups", "members", "notifications"];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar/>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-8 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Console</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage groups, messages, and meetings.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowMeeting(true)} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Schedule Meeting
            </button>
            <button onClick={() => setShowCreateGroup(true)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Group
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Groups", value: groups.length },
            { label: "Members", value: allMembers.length },
            { label: "Meetings", value: meetings.filter((m) => m.status === "scheduled").length },
            { label: "Notifications", value: notifications.filter((n) => !n.isRead).length },
          ].map((s) => (
            <div key={s.label} className="card-p text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="section-title mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === t ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Groups tab */}
        {activeTab === "groups" && (
          <div className="space-y-3">
            {loadingGroups ? (
              <div className="text-center py-16 text-slate-400 text-sm flex items-center justify-center gap-2"><Spinner/> Loading groups…</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-600 dark:text-slate-400 font-medium">No groups yet</p>
                <p className="text-slate-400 text-sm mt-1">Create your first group to start broadcasting.</p>
                <button onClick={() => setShowCreateGroup(true)} className="btn-primary mt-4">Create Group</button>
              </div>
            ) : groups.map((g) => (
              <GroupCard key={g._id} group={g} allMembers={allMembers}
                onMessage={setComposerGroup} onDelete={fetchAll} onRefresh={fetchAll}/>
            ))}
          </div>
        )}

        {/* Members tab */}
        {activeTab === "members" && (
          <div className="card overflow-hidden">
            {allMembers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">No member accounts yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-5 py-3 section-title">Name</th>
                    <th className="text-left px-5 py-3 section-title">Email</th>
                    <th className="text-left px-5 py-3 section-title hidden sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {allMembers.map((m) => (
                    <tr key={m._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{m.name}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.email}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs hidden sm:table-cell font-mono">
                        {format(new Date(m.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Meetings tab */}
        {activeTab === "meetings" && (
          <MeetingsPanel meetings={meetings} onCancel={handleCancelMeeting}/>
        )}

        {/* Notifications tab */}
        {activeTab === "notifications" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">{notifications.filter((n) => !n.isRead).length} unread</p>
              <button onClick={handleMarkAllRead} className="btn-ghost btn-sm">Mark all read</button>
            </div>
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No notifications yet.</div>
              ) : notifications.map((n) => (
                <div key={n._id} className={`card p-4 flex items-start gap-3 animate-fade-in ${!n.isRead ? "border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10" : ""}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? "bg-brand-500" : "bg-transparent"}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</p>}
                    <p className="text-xs text-slate-400 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal allMembers={allMembers} onClose={() => setShowCreateGroup(false)}
          onCreated={() => { fetchAll(); setShowCreateGroup(false); }}/>
      )}
      {composerGroup && (
        <MessageComposer group={composerGroup} onClose={() => setComposerGroup(null)} onSent={fetchAll}/>
      )}
      {showMeeting && (
        <MeetingModal groups={groups} onClose={() => setShowMeeting(false)}
          onCreated={() => { fetchMeetings(); setShowMeeting(false); }}/>
      )}
    </div>
  );
}
