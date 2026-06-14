/**
 * PollsPage — Polls Feature
 * Admin view: create polls, view stats, close, delete
 * Member view: vote on active polls, see live results
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import { pollService } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";
import { useSocket } from "../../context/SocketContext";
import { formatDistanceToNow } from "date-fns";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

// ── Create Poll Modal ─────────────────────────────────────────────────────────
const PollModal = ({ onClose, onSaved }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);

  const addOption = () => {
    if (options.length >= 8) return toast.error("Maximum 8 options.");
    setOptions((p) => [...p, ""]);
  };

  const removeOption = (idx) => {
    if (options.length <= 2) return toast.error("Minimum 2 options required.");
    setOptions((p) => p.filter((_, i) => i !== idx));
  };

  const updateOption = (idx, val) => {
    setOptions((p) => p.map((o, i) => (i === idx ? val : o)));
  };

  const handleSave = async () => {
    if (!question.trim()) return toast.error("Question is required.");
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (cleaned.length < 2) return toast.error("At least 2 non-empty options required.");
    const unique = [...new Set(cleaned)];
    if (unique.length !== cleaned.length) return toast.error("Duplicate options are not allowed.");

    setLoading(true);
    try {
      const { data } = await pollService.create({ question: question.trim(), options: cleaned });
      onSaved(data.poll);
      toast.success("Poll created.");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create poll.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Create New Poll</h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">Question *</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              className="input" placeholder="What would you like to ask?" maxLength={300}/>
            <p className="text-right text-xs text-slate-400 mt-1">{question.length}/300</p>
          </div>
          <div>
            <label className="label">Options *</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <input type="text" value={opt} onChange={(e) => updateOption(idx, e.target.value)}
                    className="input flex-1" placeholder={`Option ${idx + 1}`} maxLength={200}/>
                  {options.length > 2 && (
                    <button onClick={() => removeOption(idx)} className="btn-ghost btn-icon p-1.5 flex-shrink-0" title="Remove option">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button onClick={addOption} className="btn-ghost btn-sm mt-2 text-brand-600 dark:text-brand-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add option
              </button>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? <Spinner/> : "Publish Poll"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Stats Modal ───────────────────────────────────────────────────────────────
const StatsModal = ({ pollId, onClose }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    pollService.getStats(pollId).then(({ data }) => setStats(data)).catch(() => toast.error("Failed to load stats."));
  }, [pollId]);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-md w-full">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900 dark:text-white">Poll Stats</h3>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {!stats ? (
            <div className="flex justify-center py-8"><Spinner/></div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">{stats.question}</p>

              <div className="flex gap-4">
                <div className="flex-1 card-p text-center">
                  <p className="text-2xl font-bold text-brand-600">{stats.totalVotes}</p>
                  <p className="section-title mt-1">Votes</p>
                </div>
                <div className="flex-1 card-p text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.participationRate}%</p>
                  <p className="section-title mt-1">Participation</p>
                </div>
              </div>

              {/* Participation bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Participation rate</span>
                  <span>{stats.totalVotes} / {stats.totalMembers} members</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-2 bg-brand-500 rounded-full transition-all"
                    style={{ width: `${stats.participationRate}%` }}/>
                </div>
              </div>

              {/* Per-option breakdown */}
              <div className="space-y-3">
                <p className="section-title">Results</p>
                {stats.options.map((opt, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{opt.text}</span>
                      <span className="text-slate-500 text-xs">{opt.voteCount} votes ({opt.percentage}%)</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${opt.percentage}%`,
                          backgroundColor: idx === 0 ? '#6366f1' : idx === 1 ? '#8b5cf6' : idx === 2 ? '#a78bfa'
                            : idx === 3 ? '#06b6d4' : idx === 4 ? '#14b8a6' : idx === 5 ? '#f59e0b'
                            : idx === 6 ? '#ef4444' : '#ec4899',
                        }}/>
                    </div>
                    {/* Voter list */}
                    {opt.voters.length > 0 && (
                      <div className="ml-2 space-y-0.5 max-h-28 overflow-y-auto">
                        {opt.voters.map((v, vi) => (
                          <div key={vi} className="flex items-center justify-between py-0.5 px-2 bg-slate-50 dark:bg-slate-700/50 rounded text-xs">
                            <span className="text-slate-600 dark:text-slate-400">{v.name}</span>
                            <span className="text-slate-400">{v.votedAt ? formatDistanceToNow(new Date(v.votedAt), { addSuffix: true }) : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer"><button onClick={onClose} className="btn-secondary">Close</button></div>
      </div>
    </div>
  );
};

// ── Poll Card ─────────────────────────────────────────────────────────────────
const PollCard = ({ poll, isAdmin, onClose, onDelete, onStats, onVoted }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [voting, setVoting] = useState(false);
  const showResults = poll.hasVoted || poll.status === "closed" || isAdmin;

  const handleVote = async () => {
    if (selectedOption === null) return toast.error("Please select an option.");
    setVoting(true);
    try {
      const { data } = await pollService.vote(poll._id, selectedOption);
      onVoted(data.poll);
      toast.success("Vote recorded!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to vote.");
    } finally {
      setVoting(false);
    }
  };

  const optionColors = ['#6366f1', '#8b5cf6', '#a78bfa', '#06b6d4', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`badge ${
                poll.status === "active"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              }`}>
                {poll.status === "active" ? "🟢 Active" : "🔴 Closed"}
              </span>
              {poll.hasVoted && (
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">✓ Voted</span>
              )}
              <span className="text-xs text-slate-400">
                {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white leading-snug">{poll.question}</h3>
            <p className="text-xs text-slate-400 mt-1">
              By {poll.createdBy?.name} · {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onStats(poll._id)} className="btn-ghost btn-sm" title="Stats">📊</button>
              {poll.status === "active" && (
                <button onClick={() => onClose(poll._id)} className="btn-ghost btn-sm" title="Close poll">🔒</button>
              )}
              <button onClick={() => onDelete(poll._id)} className="btn-danger btn-sm" title="Delete">🗑</button>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="mt-4 space-y-2">
          {poll.options.map((opt, idx) => {
            const percentage = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
            const isVotedOption = poll.votedOptionIndex === idx;
            const isWinning = poll.totalVotes > 0 && opt.voteCount === Math.max(...poll.options.map(o => o.voteCount));

            if (showResults) {
              return (
                <div key={idx} className={`relative rounded-lg overflow-hidden border transition-all ${
                  isVotedOption
                    ? "border-brand-400 dark:border-brand-500 ring-1 ring-brand-200 dark:ring-brand-800"
                    : "border-slate-200 dark:border-slate-700"
                }`}>
                  {/* Background bar */}
                  <div className="absolute inset-0 transition-all duration-700 ease-out rounded-lg opacity-15"
                    style={{ width: `${percentage}%`, backgroundColor: optionColors[idx % optionColors.length] }}/>
                  <div className="relative flex items-center justify-between px-3.5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {isVotedOption && (
                        <svg className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                      <span className={`text-sm ${isWinning ? "font-semibold" : "font-medium"} text-slate-800 dark:text-slate-200`}>
                        {opt.text}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0 ml-2">
                      {percentage}%
                      <span className="text-xs font-normal text-slate-400 ml-1">({opt.voteCount})</span>
                    </span>
                  </div>
                </div>
              );
            }

            // Voting mode
            return (
              <label key={idx}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all hover:border-brand-300 dark:hover:border-brand-600 ${
                  selectedOption === idx
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-500 ring-1 ring-brand-200 dark:ring-brand-800"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}>
                <input type="radio" name={`poll-${poll._id}`} value={idx}
                  checked={selectedOption === idx}
                  onChange={() => setSelectedOption(idx)}
                  className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500 dark:border-slate-600"/>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.text}</span>
              </label>
            );
          })}
        </div>

        {/* Vote button (only if not voted, poll is active, and user is not admin-only viewer) */}
        {!showResults && poll.status === "active" && (
          <div className="mt-3 flex justify-end">
            <button onClick={handleVote} disabled={voting || selectedOption === null} className="btn-primary btn-sm">
              {voting ? <Spinner/> : "Submit Vote"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Summary Stats Bar ─────────────────────────────────────────────────────────
const StatsSummary = ({ polls }) => {
  const active = polls.filter((p) => p.status === "active").length;
  const closed = polls.filter((p) => p.status === "closed").length;
  const totalVotes = polls.reduce((sum, p) => sum + p.totalVotes, 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="card-p text-center">
        <p className="text-xl font-bold text-emerald-600">{active}</p>
        <p className="section-title mt-0.5">Active</p>
      </div>
      <div className="card-p text-center">
        <p className="text-xl font-bold text-slate-500">{closed}</p>
        <p className="section-title mt-0.5">Closed</p>
      </div>
      <div className="card-p text-center">
        <p className="text-xl font-bold text-brand-600">{totalVotes}</p>
        <p className="section-title mt-0.5">Total Votes</p>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PollsPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statsId, setStatsId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all"); // all | active | closed (admin only)

  const fetchPolls = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const fetchFn = isAdmin ? pollService.getAdminAll : pollService.getAll;
      const { data } = await fetchFn({ page: p, limit: 20 });
      setPolls(p === 1 ? data.polls : (prev) => [...prev, ...data.polls]);
      setTotalPages(data.pages);
      setPage(data.page);
    } catch {
      toast.error("Failed to load polls.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPolls(1);
  }, [fetchPolls]);

  // Real-time: new poll from socket
  useEffect(() => {
    if (!socket) return;
    const handleNewPoll = () => fetchPolls(1);
    const handleVoteUpdate = ({ pollId, totalVotes, options }) => {
      setPolls((prev) =>
        prev.map((p) => {
          if (p._id !== pollId) return p;
          return {
            ...p,
            totalVotes,
            options: p.options.map((opt, idx) => ({
              ...opt,
              voteCount: options[idx]?.voteCount ?? opt.voteCount,
            })),
          };
        })
      );
    };

    socket.on("new_poll", handleNewPoll);
    socket.on("poll_vote_update", handleVoteUpdate);
    return () => {
      socket.off("new_poll", handleNewPoll);
      socket.off("poll_vote_update", handleVoteUpdate);
    };
  }, [socket, fetchPolls]);

  const handleSaved = (saved) => {
    setPolls((p) => [{ ...saved, totalVotes: 0, hasVoted: false, votedOptionIndex: -1 }, ...p]);
  };

  const handleClose = async (id) => {
    if (!window.confirm("Close this poll? Members will no longer be able to vote.")) return;
    try {
      const { data } = await pollService.close(id);
      setPolls((p) => p.map((poll) => (poll._id === id ? data.poll : poll)));
      toast.success("Poll closed.");
    } catch {
      toast.error("Failed to close poll.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this poll?")) return;
    try {
      await pollService.remove(id);
      setPolls((p) => p.filter((poll) => poll._id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleVoted = (updatedPoll) => {
    setPolls((p) => p.map((poll) => (poll._id === updatedPoll._id ? updatedPoll : poll)));
  };

  // Filter logic (admin can filter by status)
  const filteredPolls = isAdmin && filter !== "all"
    ? polls.filter((p) => p.status === filter)
    : polls;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar/>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Polls</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm pl-10">
              {isAdmin ? "Create and manage polls for your team." : "Vote on active polls and see results."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              New Poll
            </button>
          )}
        </div>

        {/* Stats summary */}
        {!loading && polls.length > 0 && <StatsSummary polls={polls}/>}

        {/* Admin filter tabs */}
        {isAdmin && polls.length > 0 && (
          <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {["all", "active", "closed"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filter === f
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Spinner/> Loading…</div>
        ) : filteredPolls.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              {filter !== "all" ? `No ${filter} polls.` : "No polls yet."}
            </p>
            {isAdmin && filter === "all" && (
              <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Create first poll</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPolls.map((poll) => (
              <PollCard key={poll._id} poll={poll} isAdmin={isAdmin}
                onClose={handleClose} onDelete={handleDelete}
                onStats={setStatsId} onVoted={handleVoted}/>
            ))}
            {page < totalPages && (
              <div className="text-center pt-2">
                <button onClick={() => fetchPolls(page + 1)} className="btn-secondary btn-sm">Load more</button>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && <PollModal onClose={() => setShowModal(false)} onSaved={handleSaved}/>}
      {statsId && <StatsModal pollId={statsId} onClose={() => setStatsId(null)}/>}
    </div>
  );
}
