import { Resend } from "resend";

/**
 * Send an email using Resend API (HTTPS)
 * Avoids SMTP port blocking issues on Render/Heroku
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  console.log("=== RESEND MAILER EXECUTED ===");
  console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
  console.log("EMAIL_FROM:", process.env.EMAIL_FROM);

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing in Render environment variables");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject,
      html,
      text: text || "",
    });

    if (error) {
      console.error("[Resend Error]", error);
      throw new Error(JSON.stringify(error));
    }

    console.log("[Resend Success]", data);
    return data;
  } catch (err) {
    console.error("[Mailer Exception]", err);
    throw err;
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