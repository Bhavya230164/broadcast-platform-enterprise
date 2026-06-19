import { format } from "date-fns";

export const localDateTimeInputToUtcIso = (value) => {
  if (!value) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid meeting date/time.");
  }

  return date.toISOString();
};

export const meetingDate = (scheduledAt) => {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid meeting date/time.");
  }
  return date;
};

export const formatMeetingDate = (scheduledAt, pattern) => (
  format(meetingDate(scheduledAt), pattern)
);

export const meetingDateKey = (scheduledAt) => (
  formatMeetingDate(scheduledAt, "yyyy-MM-dd")
);
