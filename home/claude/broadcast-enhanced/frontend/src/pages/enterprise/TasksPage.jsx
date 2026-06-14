/**
 * TasksPage — Employee Task Assignment
 * Admin: assign tasks, view all tasks with filters, progress dashboard
 * Member: view own tasks, update progress, mark complete
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import { taskService, groupService } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";
import { useSocket } from "../../context/SocketContext";
import { format, formatDistanceToNow, isPast } from "date-fns";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
  completed:   { label: "Completed",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  overdue:     { label: "Overdue",     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
};

const PRIORITY_CONFIG = {
  low:      { label: "Low",      color: "badge-normal" },
  normal:   { label: "Normal",   color: "badge-normal" },
  high:     { label: "High",     color: "badge-important" },
  critical: { label: "Critical", color: "badge-urgent" },
};

// ── Assign Task Modal (Admin) ─────────────────────────────────────────────────
const AssignTaskModal = ({ members, onClose, onAssigned }) => {
  const [form, setForm] = useState({
    title: "", description: "", assignedTo: "",
    priority: "normal", dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAssign = async () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.assignedTo) return toast.error("Select a member.");
    if (!form.dueDate) return toast.error("Due date is required.");
    setLoading(true);
    try {
      const { data } = await taskService.create(form);
      toast.success("Task assigned!");
      onAssigned(data.task);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign task.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Assign Task</h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Task title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="input" placeholder="Complete Q4 report…" maxLength={200}/>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              className="input resize-none" rows={3} placeholder="Task details…" maxLength={2000}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assign to *</label>
              <select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} className="input">
                <option value="">Select member…</option>
                {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="input">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due date *</label>
            <input type="datetime-local" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="input"/>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleAssign} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Assigning…</> : "Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Update Task Modal (Member) ────────────────────────────────────────────────
const UpdateTaskModal = ({ task, onClose, onUpdated }) => {
  const [progress, setProgress] = useState(task.progress || 0);
  const [notes, setNotes] = useState(task.notes || "");
  const [status, setStatus] = useState(task.status === "overdue" ? "in_progress" : task.status);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { data } = await taskService.updateMine(task._id, { progress, notes, status });
      toast.success("Task updated!");
      onUpdated(data.task);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update task.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">{task.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Update your progress</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body space-y-5">
          {/* Progress slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Progress</label>
              <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{progress}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-600"/>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div className="h-2 bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}/>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {["pending", "in_progress", "completed"].map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border capitalize transition-all ${
                    status === s
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                  }`}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes / Updates</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="input resize-none" rows={3}
              placeholder="Add a progress note…" maxLength={1000}/>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleUpdate} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Saving…</> : "Save Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, isAdmin, onUpdate, onDelete }) => {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const isOverdue = task.status === "overdue";
  const borderColor = isOverdue ? "border-l-red-500" : task.status === "completed" ? "border-l-emerald-500" : "border-l-transparent";

  return (
    <div className={`card p-4 border-l-4 ${borderColor} animate-fade-in`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`badge ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`}/>
              {cfg.label}
            </span>
            <span className={priCfg.color}>{priCfg.label}</span>
            {task.completedAt && (
              <span className="text-xs text-emerald-500">✓ Done {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
            )}
          </div>
          <h4 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-400">
            {isAdmin
              ? <span>👤 {task.assignedTo?.name || "—"}</span>
              : <span>Assigned by {task.assignedBy?.name || "Admin"}</span>
            }
            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
              📅 Due {format(new Date(task.dueDate), "MMM d, yyyy")}
              {isOverdue && " (overdue)"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {!isAdmin && task.status !== "completed" && (
            <button onClick={() => onUpdate(task)} className="btn-primary btn-sm">Update</button>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(task._id)} className="btn-danger btn-sm">Delete</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-1.5 rounded-full transition-all ${task.status === "completed" ? "bg-emerald-500" : "bg-brand-500"}`}
              style={{ width: `${task.progress}%` }}/>
          </div>
        </div>
      )}

      {task.notes && (
        <div className="mt-3 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs text-slate-600 dark:text-slate-300 italic">
          "{task.notes}"
        </div>
      )}
    </div>
  );
};

// ── Summary Stats Bar ─────────────────────────────────────────────────────────
const SummaryBar = ({ summary }) => {
  const items = [
    { key: "pending", label: "Pending", color: "text-slate-600 dark:text-slate-300" },
    { key: "in_progress", label: "In Progress", color: "text-blue-600 dark:text-blue-400" },
    { key: "completed", label: "Completed", color: "text-emerald-600 dark:text-emerald-400" },
    { key: "overdue", label: "Overdue", color: "text-red-600 dark:text-red-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map((i) => (
        <div key={i.key} className="card-p text-center">
          <p className={`text-2xl font-bold ${i.color}`}>{summary[i.key] || 0}</p>
          <p className="section-title mt-1">{i.label}</p>
        </div>
      ))}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [updateTask, setUpdateTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      if (isAdmin) {
        const { data } = await taskService.getAll(params);
        setTasks(data.tasks);
        setSummary(data.summary);
      } else {
        const { data } = await taskService.getMine(params);
        setTasks(data.tasks);
        setSummary(data.summary);
      }
    } catch { toast.error("Failed to load tasks."); }
    finally { setLoading(false); }
  }, [isAdmin, statusFilter]);

  const fetchMembers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await groupService.getUsers();
      setMembers(data.members);
    } catch {}
  }, [isAdmin]);

  useEffect(() => { fetchTasks(); fetchMembers(); }, [fetchTasks, fetchMembers]);

  // Real-time: new task assigned (member side)
  useEffect(() => {
    if (!socket || isAdmin) return;
    const handler = ({ taskId, title }) => {
      toast(`📋 New task: ${title}`, { icon: "📋", duration: 6000 });
      fetchTasks();
    };
    socket.on("task_assigned", handler);
    return () => socket.off("task_assigned", handler);
  }, [socket, isAdmin, fetchTasks]);

  // Real-time: task completed (admin side)
  useEffect(() => {
    if (!socket || !isAdmin) return;
    const handler = ({ title, completedBy }) => {
      toast.success(`✅ ${completedBy} completed: ${title}`);
      fetchTasks();
    };
    socket.on("task_completed", handler);
    return () => socket.off("task_completed", handler);
  }, [socket, isAdmin, fetchTasks]);

  const handleAssigned = (task) => {
    setTasks((p) => [task, ...p]);
    setSummary((p) => ({ ...p, pending: (p.pending || 0) + 1 }));
  };

  const handleUpdated = (updated) => {
    setTasks((p) => p.map((t) => t._id === updated._id ? updated : t));
    fetchTasks(); // refresh summary
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await taskService.remove(id);
      setTasks((p) => p.filter((t) => t._id !== id));
      toast.success("Task deleted.");
    } catch { toast.error("Failed to delete task."); }
  };

  const filterStatuses = ["", "pending", "in_progress", "completed", "overdue"];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar/>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isAdmin ? "Task Management" : "My Tasks"}
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm pl-10">
              {isAdmin ? "Assign and track employee tasks." : "Your assigned tasks and deadlines."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAssign(true)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Assign Task
            </button>
          )}
        </div>

        <SummaryBar summary={summary}/>

        {/* Filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {filterStatuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all capitalize ${
                statusFilter === s
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
              }`}>
              {s === "" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Spinner/> Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              {statusFilter ? `No ${statusFilter.replace("_", " ")} tasks.` : "No tasks yet."}
            </p>
            {isAdmin && (
              <button onClick={() => setShowAssign(true)} className="btn-primary mt-4">Assign first task</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <TaskCard key={t._id} task={t} isAdmin={isAdmin}
                onUpdate={setUpdateTask} onDelete={handleDelete}/>
            ))}
          </div>
        )}
      </main>

      {showAssign && (
        <AssignTaskModal members={members} onClose={() => setShowAssign(false)} onAssigned={handleAssigned}/>
      )}
      {updateTask && (
        <UpdateTaskModal task={updateTask} onClose={() => setUpdateTask(null)} onUpdated={handleUpdated}/>
      )}
    </div>
  );
}
