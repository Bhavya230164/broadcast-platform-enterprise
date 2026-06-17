/**
 * MeetingsPage — Dedicated standalone page for viewing meetings.
 * Shows upcoming and past meetings with join actions, meeting details,
 * and real-time socket updates for new/cancelled/reminded meetings.
 */
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Navbar from "../components/layout/Navbar";
import { meetingService } from "../services/api";
import { useSocket } from "../context/SocketContext";
import useAuthStore from "../store/useAuthStore";
import { format, formatDistanceToNow, isPast } from "date-fns";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

// ── Meeting card ───────────────────────────────────────────────────────────────
const MeetingCard = ({ meeting, onJoin }) => {
  const isUpcoming = !isPast(new Date(meeting.scheduledAt));
  const platformIcon = meeting.platform === "google_meet" ? "🎥" : meeting.platform === "zoom" ? "💻" : "📹";

  return (
    <div className={`card p-5 animate-fade-in transition-all hover:shadow-sm ${isUpcoming ? "border-brand-200 dark:border-brand-800" : "border-slate-200 dark:border-slate-700"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-lg">{platformIcon}</span>
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{meeting.title}</h3>
            <span className={`badge text-[10px] ${
              meeting.status === "cancelled" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
              meeting.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
              isUpcoming ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" :
              "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {meeting.status === "cancelled" ? "Cancelled" : meeting.status === "completed" ? "Completed" : isUpcoming ? "Upcoming" : "Past"}
            </span>
            {meeting.hasJoined && (
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">✅ Joined</span>
            )}
          </div>
          {meeting.description && (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{meeting.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1">
              📅 {format(new Date(meeting.scheduledAt), "EEEE, MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1">
              🕐 {format(new Date(meeting.scheduledAt), "h:mm a")}
            </span>
            <span>⏱ {meeting.durationMinutes} min</span>
          </div>
          {(meeting.groupName || meeting.groupId?.name) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              👥 Group: {meeting.groupName || meeting.groupId?.name}
            </p>
          )}
          {!isUpcoming && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
              Ended {formatDistanceToNow(new Date(meeting.scheduledAt), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Join button */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {meeting.meetingLink && isUpcoming && (
            <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer"
              onClick={() => onJoin(meeting._id)}
              className="btn-primary btn-sm no-underline">
              🔗 Join Meeting
            </a>
          )}
          {!meeting.meetingLink && isUpcoming && (
            <span className="text-xs text-slate-500 dark:text-slate-400 italic">No link yet</span>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
        <span>👥 {meeting.invitees?.length || 0} invitees</span>
        <span>✅ {meeting.joinedBy?.length || 0} joined</span>
      </div>
    </div>
  );
};

// ── Main MeetingsPage ──────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const isAdmin = user?.role === "admin";

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | upcoming | past

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = isAdmin
        ? await meetingService.getAdminMeetings()
        : await meetingService.getMemberMeetings();
      setMeetings(data.meetings);
    } catch {
      toast.error("Failed to load meetings.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleMeetingScheduled = (data) => {
      fetchMeetings();
      toast(`📅 Meeting scheduled: ${data.title}`, { duration: 7000 });
    };

    const handleMeetingCancelled = ({ title }) => {
      fetchMeetings();
      toast.error(`Meeting cancelled: ${title}`);
    };

    const handleMeetingReminder = ({ title, minutesBefore, meetingLink }) => {
      toast(
        (t) => (
          <div>
            <div className="font-medium text-sm">⏰ Meeting in {minutesBefore} minutes</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{title}</div>
            {meetingLink && (
              <a href={meetingLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-500 hover:underline mt-1 block">Join now →</a>
            )}
          </div>
        ),
        { duration: 12000 }
      );
    };

    socket.on("meeting_scheduled", handleMeetingScheduled);
    socket.on("meeting_cancelled", handleMeetingCancelled);
    socket.on("meeting_reminder", handleMeetingReminder);

    return () => {
      socket.off("meeting_scheduled", handleMeetingScheduled);
      socket.off("meeting_cancelled", handleMeetingCancelled);
      socket.off("meeting_reminder", handleMeetingReminder);
    };
  }, [socket, fetchMeetings]);

  const handleJoinMeeting = async (meetingId) => {
    try {
      await meetingService.join(meetingId);
      setMeetings((p) => p.map((m) => m._id === meetingId ? { ...m, hasJoined: true } : m));
    } catch {}
  };

  const handleCancelMeeting = async (meetingId) => {
    if (!window.confirm("Cancel this meeting?")) return;
    try {
      await meetingService.cancel(meetingId);
      toast.success("Meeting cancelled.");
      fetchMeetings();
    } catch {
      toast.error("Failed to cancel meeting.");
    }
  };

  // Filter meetings
  const upcomingMeetings = meetings.filter((m) => !isPast(new Date(m.scheduledAt)) && m.status !== "cancelled");
  const pastMeetings = meetings.filter((m) => isPast(new Date(m.scheduledAt)) || m.status === "cancelled");

  const displayMeetings = filter === "upcoming" ? upcomingMeetings
    : filter === "past" ? pastMeetings
    : meetings;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              📹 Meetings
            </h1>
            <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
              View and join your scheduled meetings.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total", value: meetings.length },
            { label: "Upcoming", value: upcomingMeetings.length },
            { label: "Past", value: pastMeetings.length },
          ].map((s) => (
            <div key={s.label} className="card-p text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="section-title mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <p className="section-title">Filter:</p>
          {["all", "upcoming", "past"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full border capitalize transition-all ${
                filter === f
                  ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-800"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
              }`}>
              {f === "all" ? "All Meetings" : f}
            </button>
          ))}
        </div>

        {/* Meeting list */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm flex items-center justify-center gap-2">
            <Spinner /> Loading meetings…
          </div>
        ) : displayMeetings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📅</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              {filter === "upcoming" ? "No upcoming meetings" : filter === "past" ? "No past meetings" : "No meetings scheduled"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Meetings will appear here when they are scheduled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming section */}
            {(filter === "all" || filter === "upcoming") && upcomingMeetings.length > 0 && (
              <div>
                {filter === "all" && <p className="section-title mb-3 text-brand-600 dark:text-brand-400">📌 Upcoming</p>}
                <div className="space-y-3">
                  {(filter === "upcoming" ? upcomingMeetings : upcomingMeetings).map((m) => (
                    <MeetingCard key={m._id} meeting={m} onJoin={handleJoinMeeting} />
                  ))}
                </div>
              </div>
            )}

            {/* Past section */}
            {(filter === "all" || filter === "past") && pastMeetings.length > 0 && (
              <div className={filter === "all" && upcomingMeetings.length > 0 ? "mt-8" : ""}>
                {filter === "all" && <p className="section-title mb-3">🕐 Past</p>}
                <div className="space-y-3">
                  {(filter === "past" ? pastMeetings : pastMeetings).map((m) => (
                    <MeetingCard key={m._id} meeting={m} onJoin={handleJoinMeeting} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
