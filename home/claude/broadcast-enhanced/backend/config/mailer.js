import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("RESEND ERROR:", error);
      throw error;
    }

    console.log("Email sent:", data);
    return data;
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    throw err;
  }
};

export const resetEmailHtml = (name, resetUrl) => `
  <div style="font-family:sans-serif;padding:20px">
    <h2>Reset Your Password</h2>
    <p>Hello ${name},</p>
    <p>Click the button below to reset your password.</p>

    <a href="${resetUrl}"
       style="display:inline-block;padding:12px 24px;
       background:#2563eb;color:white;text-decoration:none;
       border-radius:6px;">
       Reset Password
    </a>

    <p>This link expires in 1 hour.</p>
  </div>
`;

export const meetingReminderHtml = (name, meeting) => `
  <div>
    <h2>Meeting Reminder</h2>
    <p>Hello ${name}</p>
    <p>${meeting.title}</p>
  </div>
`;