import { env } from "../config/env.js";
import nodemailer from "nodemailer";

type EmailInput = { to: string; subject: string; html: string; text: string };

const transporter = env.GMAIL_SMTP_USER && env.GMAIL_SMTP_APP_PASSWORD
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: env.GMAIL_SMTP_USER,
        pass: env.GMAIL_SMTP_APP_PASSWORD.replace(/\s/g, ""),
      },
    })
  : null;

export async function sendEmail(input: EmailInput) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return { skipped: true as const };
  if (!transporter || !env.GMAIL_SMTP_USER) {
    throw new Error("Gmail SMTP credentials are not configured.");
  }

  const result = await transporter.sendMail({
    from: {
      name: env.EMAIL_FROM_NAME,
      address: env.GMAIL_SMTP_USER,
    },
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return {
    skipped: false as const,
    provider: { id: result.messageId },
  };
}
