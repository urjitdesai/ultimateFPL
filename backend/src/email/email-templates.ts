type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

type EmailShellInput = {
  preheader: string;
  eyebrow: string;
  headline: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  closing: string;
};

const COLORS = {
  navy: "#04142d",
  lime: "#bdf300",
  ink: "#06152d",
  muted: "#607188",
  canvas: "#eef2f6",
};

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function emailShell(input: EmailShellInput) {
  const safeUrl = escapeEmailHtml(input.ctaUrl);
  const paragraphs = input.paragraphs
    .map((paragraph) => `<p style="margin:0 0 18px;color:${COLORS.muted};font-size:16px;line-height:1.65;">${paragraph}</p>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${input.headline}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.canvas};font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${input.preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.canvas};">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-top:6px solid ${COLORS.lime};">
          <tr>
            <td style="padding:28px 34px;background:${COLORS.navy};">
              <div style="margin-top:6px;color:#aebdd0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Predictions Premier League</div>
            </td>
          </tr>
          <tr>
            <td style="padding:38px 34px 34px;">
              <div style="margin-bottom:14px;color:#587500;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">${input.eyebrow}</div>
              <h1 style="margin:0 0 20px;color:${COLORS.ink};font-size:32px;line-height:1.18;letter-spacing:-0.8px;">${input.headline}</h1>
              <p style="margin:0 0 18px;color:${COLORS.ink};font-size:16px;line-height:1.65;font-weight:700;">${input.greeting}</p>
              ${paragraphs}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 10px;">
                <tr>
                  <td bgcolor="${COLORS.lime}" style="border-radius:5px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:15px 24px;color:${COLORS.navy};font-size:15px;font-weight:800;text-decoration:none;">${input.ctaLabel} &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#8a97a8;font-size:11px;line-height:1.55;overflow-wrap:anywhere;">Button not working? Open this link:<br><a href="${safeUrl}" style="color:#155eef;text-decoration:underline;">${safeUrl}</a></p>
              <p style="margin:0;color:#7a889a;font-size:13px;line-height:1.55;">${input.closing}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 34px;background:${COLORS.navy};color:#8fa1b7;font-size:11px;line-height:1.6;">
              You received this automated game update because email notifications are enabled on your Ultimate FPL account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function predictionReminderEmail(input: {
  roundNumber: number;
  hoursBeforeDeadline: 2 | 24;
  recipientName: string;
  dashboardUrl: string;
}): EmailContent {
  const name = input.recipientName.trim() || "there";
  const safeName = escapeEmailHtml(name);
  const round = input.roundNumber;
  const timeRemaining = input.hoursBeforeDeadline === 24 ? "24 hours" : "2 hours";
  const headline = input.hoursBeforeDeadline === 24
    ? "One day to go. Lock in your Gameweek calls."
    : "Two hours. Ten fixtures. Make every call count.";

  return {
    subject: `${timeRemaining} left: lock in your Gameweek ${round} predictions`,
    html: emailShell({
      preheader: `Only ${timeRemaining} remain before Gameweek ${round} predictions lock.`,
      eyebrow: `Deadline alert · Gameweek ${round}`,
      headline,
      greeting: `Hi ${safeName},`,
      paragraphs: [
        `The Gameweek ${round} deadline is ${input.hoursBeforeDeadline === 24 ? "one day away" : "almost here"}. Lock in your scorelines now so you do not miss the chance to climb your leagues.`,
      ],
      ctaLabel: "Make my predictions",
      ctaUrl: input.dashboardUrl,
      closing: input.hoursBeforeDeadline === 24
        ? "Make your calls early—you can revisit them anytime before the gameweek locks."
        : "The clock is running. Submit your predictions before the gameweek locks.",
    }),
    text: [
      `Hi ${name},`,
      "",
      `Only ${timeRemaining} remain before the Gameweek ${round} deadline. Lock in your score predictions before time runs out.`,
      "",
      `Make your predictions: ${input.dashboardUrl}`,
      "",
      input.hoursBeforeDeadline === 24
        ? "Make your calls early—you can revisit them anytime before the gameweek locks."
        : "The clock is running. Submit your predictions before the gameweek locks.",
    ].join("\n"),
  };
}

export function gameweekResultsEmail(input: {
  roundNumber: number;
  recipientName: string;
  dashboardUrl: string;
}): EmailContent {
  const name = input.recipientName.trim() || "there";
  const safeName = escapeEmailHtml(name);
  const round = input.roundNumber;

  return {
    subject: `Gameweek ${round} results are in — see how you ranked`,
    html: emailShell({
      preheader: `Gameweek ${round} has been scored. Your points and new league positions are ready.`,
      eyebrow: `Results ready · Gameweek ${round}`,
      headline: "The final whistle has blown. How did your calls land?",
      greeting: `Hi ${safeName},`,
      paragraphs: [
        `Gameweek ${round} has been scored, and your results are waiting. See where your exact scores, captain pick, and wager took you.`,
      ],
      ctaLabel: "Check Results",
      ctaUrl: input.dashboardUrl,
      closing: "Every point changes the table. See where you stand before the next round begins.",
    }),
    text: [
      `Hi ${name},`,
      "",
      `Gameweek ${round} has been scored. See your prediction points, captain bonus, wager result, and updated league positions.`,
      "",
      `Reveal your results: ${input.dashboardUrl}`,
      "",
      "Every point changes the table. See where you stand before the next round begins.",
    ].join("\n"),
  };
}
