import { formatMeetingDate } from "./meetingTime";

const isMeetingScheduledNotification = (notification) => (
  notification?.type === "meeting_scheduled" && notification?.metadata?.scheduledAt
);

export const getNotificationBody = (notification) => {
  if (!isMeetingScheduledNotification(notification)) {
    return notification?.body || "";
  }

  const time = formatMeetingDate(notification.metadata.scheduledAt, "h:mm a");
  return `Meeting scheduled for ${time}`;
};

export const getNotificationTimestamp = (notification) => {
  const timestamp = isMeetingScheduledNotification(notification)
    ? notification.metadata.scheduledAt
    : notification?.timestamp || notification?.createdAt || notification?.updatedAt;

  return timestamp ? formatMeetingDate(timestamp, "h:mm a") : "";
};


