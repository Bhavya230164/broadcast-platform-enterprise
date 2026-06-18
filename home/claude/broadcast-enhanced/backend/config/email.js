import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  const data = await resend.emails.send({
    from: "Broadcast Platform <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  console.log("EMAIL SENT:", data);
  return data;
};