/**
 * Nodemailer configuration
 * Used for: OTP login, password reset, meeting reminders
 */
import nodemailer from "nodemailer";

export const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: port,
    secure: port === 465, // true for 465, false for other ports
    connectionTimeout: 10000, // 10 seconds max wait
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send an email. Falls back to console.log in development if EMAIL_USER is not set.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  // In dev without email config, just log
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === "your_email@gmail.com") {
    console.log(`\n[Mailer] DEV MODE — Email not sent. To enable email sending, please configure EMAIL_USER and EMAIL_PASS in your .env file. Would have sent to: ${to}`);
    console.log(`[Mailer] Subject: ${subject}`);
    console.log(`[Mailer] Text: ${text || "(html only)"}\n`);
    return { messageId: "dev-mode-email-not-configured" };
  }

  const transporter = createTransporter();
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Broadcast Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Mailer] Email sent successfully: ${info.messageId} → ${to}`);
    return info;
  } catch (error) {
    console.error(`[Mailer] Error occurred while sending email to ${to}:`, error.message);
    throw error; // Re-throw to be handled by the controller
  }
};


/** Password reset email template */
export const resetEmailHtml = (name, resetUrl) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:8px;">
    <h2 style="color:#1a1a1a;margin-bottom:8px;">Reset Your Password</h2>
    <p style="color:#555;margin-bottom:24px;">Hi ${name}, click the button below to reset your password. The link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
    <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request a password reset, you can safely ignore this email.</p>
  </div>
`;

/** Meeting reminder email template */
export const meetingReminderHtml = (name, meeting) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:8px;">
    <h2 style="color:#1a1a1a;">Meeting Reminder</h2>
    <p style="color:#555;">Hi ${name}, your meeting is coming up soon.</p>
    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin:16px 0;">
      <p><strong>${meeting.title}</strong></p>
      <p style="color:#555;">${new Date(meeting.scheduledAt).toLocaleString()}</p>
      ${meeting.meetingLink ? `<a href="${meeting.meetingLink}" style="color:#2563eb;">Join Meeting →</a>` : ""}
    </div>
  </div>
`;
