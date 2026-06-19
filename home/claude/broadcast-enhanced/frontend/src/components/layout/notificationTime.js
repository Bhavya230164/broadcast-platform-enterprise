import { format, formatDistanceToNow } from "date-fns";
import { meetingDate } from "../../utils/meetingTime";

export const getNotificationBody = (notification) => {
    if (notification.body) return notification.body;
    if (notification.metadata?.groupName) return `Group: ${notification.metadata.groupName}`;
    return "";
};

export const getNotificationTimestamp = (notification) => {
    if ((notification.type === "meeting_reminder" || notification.type === "meeting_scheduled") && notification.metadata?.scheduledAt) {
        const scheduledAt = meetingDate(notification.metadata.scheduledAt);
        return `For meeting at ${format(scheduledAt, "MMM d, h:mm a")}`;
    }
    return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
};