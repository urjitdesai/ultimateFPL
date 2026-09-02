import { env } from "../config/env.js";
import { Resend } from "resend";

type EmailInput = { to: string; subject: string; html: string; text: string };

export async function sendEmail(input: EmailInput) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED || !env.RESEND_MAILER_API_KEY) return { skipped: true as const };
  const resend = new Resend(env.RESEND_MAILER_API_KEY);
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(`Resend delivery failed: ${error.message}`);
  return { skipped: false as const, provider: data ?? {} };
}
