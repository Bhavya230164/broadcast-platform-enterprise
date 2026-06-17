/**
 * KnowledgeBasePage — Company Library
 * Admin: upload, edit, delete documents
 * Member: browse, search, filter by category, download
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import { kbService } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const CATEGORIES = [
  "All",
  "HR Policies",
  "Training Materials",
  "Company Documents",
  "Technical Guides",
  "General",
];

const FILE_ICONS = {
  image: "🖼️",
  pdf: "📄",
  document: "📝",
  other: "📎",
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

// ── Upload Modal (Admin) ───────────────────────────────────────────────────────
const UploadModal = ({ onClose, onUploaded }) => {
  const [form, setForm] = useState({ title: "", description: "", category: "General", tags: "" });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleUpload = async () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!file) return toast.error("Please select a file.");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("category", form.category);
      formData.append("tags", form.tags);
      const { data } = await kbService.upload(formData);
      toast.success("Document uploaded.");
      onUploaded(data.document);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Upload Document</h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body space-y-4">
          {/* File picker */}
          <div>
            <label className="label">File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20" : "border-slate-300 dark:border-slate-600 hover:border-brand-400"
              }`}>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}/>
              {file ? (
                <div>
                  <p className="text-2xl mb-1">{FILE_ICONS[file.type?.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "document"]}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Click to select file</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, Images, ZIP · Max 10 MB</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="label">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="input" placeholder="Document title…" maxLength={200}/>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              className="input resize-none" rows={2} placeholder="Optional description…" maxLength={1000}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input">
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input type="text" value={form.tags} onChange={(e) => set("tags", e.target.value)}
                className="input" placeholder="policy, onboarding…"/>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleUpload} disabled={loading} className="btn-primary">
            {loading ? <><Spinner/> Uploading…</> : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Document Card ─────────────────────────────────────────────────────────────
const DocCard = ({ doc, isAdmin, onDelete }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await kbService.trackDownload(doc._id);
      const link = document.createElement("a");
      link.href = `${API_BASE}${doc.file.url}`;
      link.download = doc.file.originalName;
      link.target = "_blank";
      link.click();
    } catch { /* silent */ }
    finally { setDownloading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    try {
      await kbService.remove(doc._id);
      onDelete(doc._id);
      toast.success("Document deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  return (
    <div className="card p-4 flex items-start gap-4 hover:shadow-sm transition-shadow animate-fade-in group">
      <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
        {FILE_ICONS[doc.file?.fileType] || "📎"}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900 dark:text-white text-sm leading-snug">{doc.title}</h4>
        {doc.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{doc.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">{doc.category}</span>
          <span className="text-xs text-slate-400">{formatBytes(doc.file?.size || 0)}</span>
          <span className="text-xs text-slate-400">↓ {doc.downloadCount}</span>
          {doc.tags?.map((t) => (
            <span key={t} className="badge-normal text-[10px]">#{t}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button onClick={handleDownload} disabled={downloading}
          className="btn-primary btn-sm">
          {downloading ? <Spinner/> : "↓ Download"}
        </button>
        {isAdmin && (
          <button onClick={handleDelete} className="btn-danger btn-sm">Delete</button>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimer = useRef(null);

  const fetchDocs = useCallback(async (p = 1, reset = true) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (category !== "All") params.category = category;
      if (search.trim()) params.q = search.trim();
      const { data } = await kbService.list(params);
      setDocuments(reset ? data.documents : (prev) => [...prev, ...data.documents]);
      setTotalPages(data.pages);
      setTotal(data.total);
      setPage(data.page);
    } catch { toast.error("Failed to load documents."); }
    finally { setLoading(false); }
  }, [category, search]);

  useEffect(() => { fetchDocs(1, true); }, [fetchDocs]);

  // Debounced search
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 450);
  };

  const handleUploaded = (doc) => setDocuments((p) => [doc, ...p]);
  const handleDelete = (id) => setDocuments((p) => p.filter((d) => d._id !== id));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar/>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pt-8 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Knowledge Base</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm pl-10">
              {total} document{total !== 1 ? "s" : ""} in the company library.
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              Upload Document
            </button>
          )}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)}
              className="input pl-9" placeholder="Search documents…"/>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => { setCategory(c); setSearch(""); setSearchInput(""); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
                  category === c
                    ? "bg-brand-600 text-white border-brand-600"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Documents */}
        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Spinner/> Loading…</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No documents found.</p>
            {isAdmin && <button onClick={() => setShowUpload(true)} className="btn-primary mt-4">Upload first document</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocCard key={doc._id} doc={doc} isAdmin={isAdmin} onDelete={handleDelete}/>
            ))}
            {page < totalPages && (
              <div className="text-center pt-2">
                <button onClick={() => fetchDocs(page + 1, false)} disabled={loading} className="btn-secondary btn-sm">
                  {loading ? <Spinner/> : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploaded}/>}
    </div>
  );
}
