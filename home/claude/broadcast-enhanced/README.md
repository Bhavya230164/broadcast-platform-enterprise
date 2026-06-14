# Broadcast Communication Platform v2 — Enhanced

A production-ready, one-way broadcast communication system built with the MERN stack.

## What's New in v2

| Feature | Details |
|---|---|
| Real-time notifications | Socket.IO — messages, meetings, reminders pushed instantly |
| Read Receipts | Delivered / Read timestamps per user per message |
| Pinned Messages | Admin pins; members see a dedicated Pinned tab |
| Priority Messages | Normal / Important / Urgent with colour-coded UI |
| "I Have Read" Acknowledgement | Member confirms receipt; admin sees live ack count |
| Online / Offline Status | Per-user presence tracked via socket connect/disconnect |
| Image Sharing | Upload images in messages; inline preview in member inbox |
| PDF / Document Upload | Attach PDFs, Word, Excel — up to 5 files per message |
| Meeting Scheduling | Admin creates meetings with date, duration, group |
| Meeting Reminders | Auto email + socket push 30 min and 5 min before |
| Join Meeting Button | Google Meet / Zoom link opens in new tab; join tracked |
| Two-Factor Auth (2FA) | TOTP via Google Authenticator / Authy (QR code setup) |
| OTP Login | Email-based 6-digit OTP as alternative to password |
| Password Reset | Forgot password → email link → set new password |
| Dark Mode Toggle | Class-based Tailwind dark mode; persisted per user |
| Upload Profile Photo | Drag-and-drop or click to upload avatar |
| Change Profile Photo | Replace existing photo; old file deleted from disk |
| Remove Profile Photo | Removes photo and falls back to initial avatar |
| View Profile Image | Shown in Navbar dropdown and Profile page |

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS (dark mode) + Zustand + Socket.IO client
- **Backend:** Node.js + Express.js + Socket.IO
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + bcryptjs + speakeasy (TOTP) + nodemailer (OTP/reset)
- **Files:** Multer (local disk storage)

## Project Structure

```
broadcast-platform/
├── backend/
│   ├── config/          db.js, socket.js, mailer.js, multer.js, validation.js
│   ├── controllers/     auth, profile, group, message, meeting, notification
│   ├── middlewares/     authMiddleware.js, errorMiddleware.js, upload.js
│   ├── models/          User, Group, Message, Meeting, Notification
│   ├── routes/          auth, profile, group, message, meeting, notification
│   ├── uploads/         avatars/, files/  (auto-created)
│   └── server.js
└── frontend/
    └── src/
        ├── components/layout/   Navbar.jsx
        ├── context/             SocketContext.jsx
        ├── pages/               Login, Register, ForgotPassword, ResetPassword,
        │                        AdminDashboard, MemberDashboard, Profile, TwoFASetup
        ├── services/            api.js  (all API calls)
        ├── store/               useAuthStore.js
        ├── App.jsx
        └── main.jsx
```

## Quick Start

### 1. Configure environment

Edit `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/broadcast_platform
JWT_SECRET=your-64-char-secret-here
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
CLIENT_ORIGIN=http://localhost:5173
```

### 2. Install & run

```bash
# Install all dependencies
bash setup.sh

# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 3. First use

1. Open http://localhost:5173
2. Register an **Admin** account
3. Register one or more **Member** accounts
4. Log in as Admin → create a group → add members → send a message
5. Log in as Member → see real-time message delivery in the inbox

## API Reference

### Auth
| Method | Endpoint | Access |
|---|---|---|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| POST | /api/auth/otp/request | Public |
| POST | /api/auth/otp/verify | Public |
| POST | /api/auth/forgot-password | Public |
| POST | /api/auth/reset-password | Public |
| GET  | /api/auth/me | Protected |
| POST | /api/auth/change-password | Protected |
| GET  | /api/auth/2fa/setup | Protected |
| POST | /api/auth/2fa/enable | Protected |
| POST | /api/auth/2fa/disable | Protected |
| POST | /api/auth/verify-2fa | Temp token |

### Profile
| Method | Endpoint | Access |
|---|---|---|
| GET    | /api/profile | Protected |
| PATCH  | /api/profile | Protected |
| POST   | /api/profile/avatar | Protected |
| DELETE | /api/profile/avatar | Protected |
| PATCH  | /api/profile/dark-mode | Protected |

### Groups
| Method | Endpoint | Access |
|---|---|---|
| GET    | /api/groups | Admin |
| POST   | /api/groups | Admin |
| GET    | /api/groups/users | Admin |
| GET    | /api/groups/:id | Admin |
| PATCH  | /api/groups/:id | Admin |
| DELETE | /api/groups/:id | Admin |
| POST   | /api/groups/:id/members | Admin |
| DELETE | /api/groups/:id/members/:memberId | Admin |
| GET    | /api/groups/mine | Member |

### Messages
| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/messages/send | Admin |
| GET    | /api/messages/group/:groupId | Admin |
| PATCH  | /api/messages/:id/pin | Admin |
| GET    | /api/messages/inbox | Member |
| GET    | /api/messages/pinned | Member |
| PATCH  | /api/messages/:id/read | Member |
| PATCH  | /api/messages/:id/acknowledge | Member |

### Meetings
| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/meetings | Admin |
| GET    | /api/meetings/admin | Admin |
| PATCH  | /api/meetings/:id | Admin |
| DELETE | /api/meetings/:id | Admin |
| POST   | /api/meetings/reminders/send | Admin |
| GET    | /api/meetings/mine | Member |
| POST   | /api/meetings/:id/join | Protected |

### Notifications
| Method | Endpoint | Access |
|---|---|---|
| GET    | /api/notifications | Protected |
| GET    | /api/notifications/unread-count | Protected |
| PATCH  | /api/notifications/read-all | Protected |
| PATCH  | /api/notifications/:id/read | Protected |
| DELETE | /api/notifications/:id | Protected |

## Socket.IO Events

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ _id, content, type, priority, groupName, attachments, createdAt }` | New message delivered |
| `message_delivered` | `{ messageId }` | Delivery confirmed |
| `message_pinned` | `{ messageId }` | Admin pinned a message |
| `message_acknowledged` | `{ messageId, userId, userName, acknowledgedAt }` | Member acknowledged (admin only) |
| `meeting_scheduled` | `{ meetingId, title, scheduledAt, meetingLink }` | New meeting created |
| `meeting_cancelled` | `{ meetingId, title }` | Meeting cancelled |
| `meeting_reminder` | `{ meetingId, title, minutesBefore, meetingLink }` | Upcoming meeting alert |
| `user_status_change` | `{ userId, isOnline, lastSeen }` | Online/offline status |

### Client → Server
| Event | Description |
|---|---|
| `mark_delivered` | Client confirms delivery of a message |

## Security Notes

- All file uploads are stored locally under `backend/uploads/`
- Avatar max size: 5 MB; attachment max size: 10 MB; max 5 attachments per message
- JWT secrets should be at least 64 random characters
- 2FA TOTP secrets are stored encrypted (select: false in Mongoose)
- OTP codes expire after 10 minutes; password reset tokens after 1 hour
- Rate limiting: 300 req/15 min global, 30 req/15 min on auth routes

---

## Enterprise Features (v3 Addition)

### 1. Announcement Center (`/announcements`)
- **Backend:** `models/Announcement.js`, `controllers/announcementController.js`, `routes/announcementRoutes.js`
- **Frontend:** `pages/enterprise/AnnouncementsPage.jsx`
- Admin creates announcements with priority (Normal / Important / Urgent), optional schedule date (not shown until that time), optional expiry date (auto-hidden after), and pin toggle
- Per-user read tracking — admin sees a stats modal with read count, read rate progress bar, and list of who read it
- Members see only live (past scheduled, not expired) announcements; pinned and urgent shown first
- Real-time: `new_announcement` socket event pushes instant notification to all members

| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/announcements | Admin |
| GET    | /api/announcements/admin | Admin |
| PATCH  | /api/announcements/:id | Admin |
| DELETE | /api/announcements/:id | Admin |
| PATCH  | /api/announcements/:id/pin | Admin |
| GET    | /api/announcements/:id/stats | Admin |
| GET    | /api/announcements | Member + Admin |
| PATCH  | /api/announcements/:id/read | Member + Admin |

### 2. Knowledge Base / Company Library (`/knowledge-base`)
- **Backend:** `models/KBDocument.js`, `controllers/kbController.js`, `routes/kbRoutes.js`
- **Frontend:** `pages/enterprise/KnowledgeBasePage.jsx`
- Files stored in `uploads/kb/` via dedicated Multer config
- Categories: HR Policies, Training Materials, Company Documents, Technical Guides, General
- MongoDB text index on title + description + tags for full-text search
- Download count tracked per document; admin sees count on each card
- Admin: upload (drag-drop UI), update metadata, delete (removes file from disk)
- Member: browse, filter by category, search, download — read-only

| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/kb | Admin |
| PATCH  | /api/kb/:id | Admin |
| DELETE | /api/kb/:id | Admin |
| GET    | /api/kb | Both |
| GET    | /api/kb/:id | Both |
| POST   | /api/kb/:id/download | Both |

### 3. Employee Task Assignment (`/tasks`)
- **Backend:** `models/Task.js`, `controllers/taskController.js`, `routes/taskRoutes.js`
- **Frontend:** `pages/enterprise/TasksPage.jsx`
- Admin assigns tasks with title, description, assignee, priority (Low / Normal / High / Critical), due date
- Status lifecycle: `pending → in_progress → completed`; `overdue` auto-set when due date passes (computed on every fetch via `updateMany`)
- Member updates progress (0–100% slider), status, and notes from an update modal
- Summary stats bar (Pending / In Progress / Completed / Overdue counts) shown to both roles
- Real-time: `task_assigned` socket event notifies member instantly; `task_completed` notifies admin
- Persistent Notification created for both events

| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/tasks | Admin |
| GET    | /api/tasks/all | Admin |
| PATCH  | /api/tasks/:id | Admin |
| DELETE | /api/tasks/:id | Admin |
| GET    | /api/tasks/mine | Member |
| PATCH  | /api/tasks/:id/update | Member |

### 4. CEO / Leadership Corner (`/leadership`)
- **Backend:** `models/LeadershipPost.js`, `controllers/leadershipController.js`, `routes/leadershipRoutes.js`
- **Frontend:** `pages/enterprise/LeadershipPage.jsx`
- Post types: CEO Message, Company Vision, Goals & Strategy, Leadership Update, General
- Optional featured image upload (stored in `uploads/leadership/`)
- Per-member acknowledgement (one-click "Acknowledge" button, no replies allowed)
- View tracking — every `GET /api/leadership/:id` call records the viewer
- Admin stats modal shows view count, acknowledgement count, acknowledgement rate bar, and list of who acknowledged
- Real-time: `new_leadership_post` socket event notifies all members with type-specific icon
- Pinning supported; pinned posts appear first in the feed

| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/leadership | Admin |
| PATCH  | /api/leadership/:id | Admin |
| DELETE | /api/leadership/:id | Admin |
| PATCH  | /api/leadership/:id/pin | Admin |
| GET    | /api/leadership/:id/stats | Admin |
| GET    | /api/leadership | Both |
| GET    | /api/leadership/:id | Both |
| PATCH  | /api/leadership/:id/acknowledge | Member |

### 5. Polls (`/polls`)
- **Backend:** `models/Poll.js`, `controllers/pollController.js`, `routes/pollRoutes.js`
- **Frontend:** `pages/enterprise/PollsPage.jsx`
- Admin creates polls with a question and multiple options.
- Admin can close polls, delete polls, and view detailed stats (who voted for what).
- Members can vote once per poll and see live results update in real-time.
- Real-time: `new_poll` socket event pushes instant notification to all members, `poll_vote_update` live-updates the vote counts on screen without refresh.

| Method | Endpoint | Access |
|---|---|---|
| POST   | /api/polls | Admin |
| GET    | /api/polls/admin | Admin |
| PATCH  | /api/polls/:id/close | Admin |
| DELETE | /api/polls/:id | Admin |
| GET    | /api/polls/:id/stats | Admin |
| GET    | /api/polls | Both |
| POST   | /api/polls/:id/vote | Protected |

### Navigation
The **Navbar** gains an "Enterprise" dropdown (desktop) and mobile menu links covering all 4 features. Routes are protected; pages handle role-specific UI internally so one URL works for both admin and member with appropriate capabilities shown.

### New Socket Events (Enterprise)

| Event (Server→Client) | Payload | Trigger |
|---|---|---|
| `new_announcement` | `{ announcementId, title, priority }` | Admin publishes a live announcement |
| `task_assigned` | `{ taskId, title, priority, dueDate }` | Admin assigns a task to a member |
| `task_completed` | `{ taskId, title, completedBy }` | Member marks task complete |
| `new_leadership_post` | `{ postId, title, postType, authorLabel }` | Admin publishes a leadership post |
| `leadership_post_acknowledged` | `{ postId, title, userId, userName }` | Member acknowledges a post (→ admin room) |

### New Upload Directories
```
backend/uploads/
  avatars/      — profile photos (existing)
  files/        — message attachments (existing)
  kb/           — knowledge base documents (NEW)
  leadership/   — leadership featured images (NEW)
```
All directories are auto-created by Multer on first upload.
