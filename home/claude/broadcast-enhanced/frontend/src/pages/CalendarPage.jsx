/**
 * CalendarPage — Monthly calendar grid showing scheduled meetings.
 * Reuses existing meetingService and Navbar, no backend changes.
 */
import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/layout/Navbar";
import { meetingService } from "../services/api";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isPast } from "date-fns";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = user?.role === "admin"
        ? await meetingService.getAdminMeetings()
        : await meetingService.getMemberMeetings();
      setMeetings(data.meetings);
    } catch {
      toast.error("Failed to load meetings.");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Build calendar grid days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const calendarDays = [];
  let day = calStart;
  while (day <= calEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  // Map meetings by date key
  const meetingsByDate = {};
  meetings.forEach((m) => {
    const key = format(new Date(m.scheduledAt), "yyyy-MM-dd");
    if (!meetingsByDate[key]) meetingsByDate[key] = [];
    meetingsByDate[key].push(m);
  });

  const today = new Date();
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedMeetings = selectedKey ? meetingsByDate[selectedKey] || [] : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            🗓️ Calendar
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 min-w-[160px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Today button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              setCurrentMonth(new Date());
              setSelectedDate(new Date());
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Today
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading calendar…
          </div>
        ) : (
          <>
            {/* Calendar grid */}
            <div className="card overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((d, i) => {
                  const dateKey = format(d, "yyyy-MM-dd");
                  const dayMeetings = meetingsByDate[dateKey] || [];
                  const isCurrentMonth = isSameMonth(d, currentMonth);
                  const isToday = isSameDay(d, today);
                  const isSelected = selectedDate && isSameDay(d, selectedDate);
                  const hasUpcoming = dayMeetings.some((m) => !isPast(new Date(m.scheduledAt)));

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(d)}
                      className={`
                        relative flex flex-col items-center justify-start p-2 min-h-[72px] sm:min-h-[80px]
                        border-b border-r border-slate-100 dark:border-slate-800
                        transition-colors text-left
                        ${!isCurrentMonth ? "bg-slate-50/50 dark:bg-slate-900/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}
                        ${isSelected ? "bg-brand-50 dark:bg-brand-900/20 ring-1 ring-inset ring-brand-300 dark:ring-brand-700" : ""}
                      `}
                    >
                      <span
                        className={`
                          text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                          ${isToday ? "bg-brand-600 text-white" : ""}
                          ${!isCurrentMonth ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}
                          ${isSelected && !isToday ? "bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300" : ""}
                        `}
                      >
                        {format(d, "d")}
                      </span>

                      {/* Meeting dots */}
                      {dayMeetings.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {dayMeetings.slice(0, 3).map((m, idx) => (
                            <span
                              key={idx}
                              className={`w-1.5 h-1.5 rounded-full ${
                                hasUpcoming
                                  ? "bg-brand-500"
                                  : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            />
                          ))}
                          {dayMeetings.length > 3 && (
                            <span className="text-[9px] text-slate-400 leading-none">
                              +{dayMeetings.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected day detail panel */}
            {selectedDate && (
              <div className="mt-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    📅 {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </h3>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    Close
                  </button>
                </div>

                {selectedMeetings.length === 0 ? (
                  <div className="card p-6 text-center text-slate-400 text-sm">
                    No meetings on this day.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedMeetings.map((m) => {
                      const isUpcoming = !isPast(new Date(m.scheduledAt));
                      const platformIcon =
                        m.platform === "google_meet"
                          ? "🎥"
                          : m.platform === "zoom"
                          ? "💻"
                          : "📹";

                      return (
                        <div
                          key={m._id}
                          className={`card p-4 ${
                            isUpcoming
                              ? "border-brand-200 dark:border-brand-800"
                              : "opacity-70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-base">{platformIcon}</span>
                                <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                  {m.title}
                                </h4>
                                {isUpcoming && (
                                  <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[10px]">
                                    Upcoming
                                  </span>
                                )}
                              </div>
                              {m.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                  {m.description}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                🕐 {format(new Date(m.scheduledAt), "h:mm a")}
                                <span className="ml-2 text-slate-400">
                                  · {m.durationMinutes} min
                                </span>
                              </p>
                              {m.groupName && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Group: {m.groupName}
                                </p>
                              )}
                            </div>

                            {m.meetingLink && isUpcoming && (
                              <a
                                href={m.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary btn-sm flex-shrink-0 no-underline"
                              >
                                Join
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
