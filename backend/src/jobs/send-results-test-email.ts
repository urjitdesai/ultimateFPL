import { env } from "../config/env.js";
import { gameweekResultsEmail } from "../email/email-templates.js";
import { sendEmail } from "../email/email.service.js";

const recipient = process.argv[2]?.trim() || "urjitdesai07@gmail.com";

try {
  const email = gameweekResultsEmail({
    roundNumber: 1,
    recipientName: "Urjit",
    dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
  });
  const result = await sendEmail({ to: recipient, ...email });

  if (result.skipped) {
    throw new Error("Email delivery was skipped because notifications are disabled.");
  }

  console.log(JSON.stringify({
    status: "SENT",
    recipient,
    messageId: result.provider.id,
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: "FAILED",
    recipient,
    error: error instanceof Error ? error.message : "Unknown email delivery error",
  }));
  process.exitCode = 1;
}
