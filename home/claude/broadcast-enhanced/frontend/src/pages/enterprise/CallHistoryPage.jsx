import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Navbar from "../../components/layout/Navbar";
import { callService } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";

const STATUS_STYLES = {
  missed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  answered: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  rejected: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function CallHistoryPage() {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchCalls = async () => {
      setLoading(true);
      try {
        const { data } = await callService.getHistory();
        setCalls(data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, []);

  const filteredCalls = useMemo(() => {
    if (filter === "all") return calls;
    return calls.filter((call) => call.type === filter || call.status === filter);
  }, [calls, filter]);

  const getDirection = (call) => {
    if (call.caller?._id === user?._id || call.caller?._id === user?.id) return "Outgoing";
    return "Incoming";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Call History</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {user?.role === "admin" ? "All voice and video calls across the platform." : "Your voice and video call activity."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "voice", "video", "missed", "answered", "rejected", "completed"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors ${
                  filter === item
                    ? "bg-brand-600 text-white border-brand-600"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-slate-400">Loading call history...</div>
        ) : filteredCalls.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No calls found.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredCalls.map((call) => {
                const otherUser = call.caller?._id === user?._id || call.caller?._id === user?.id
                  ? call.receiver
                  : call.caller;
                return (
                  <div key={call._id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
                        {call.type === "video" ? "📹" : "📞"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {otherUser?.name || "Unknown user"}
                          </p>
                          <span className="text-xs text-slate-400">{getDirection(call)}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {call.type} call · {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
                          {call.duration > 0 ? ` · ${call.duration}s` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={`badge capitalize ${STATUS_STYLES[call.status] || STATUS_STYLES.missed}`}>
                      {call.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
