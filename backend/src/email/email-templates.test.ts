import { describe, expect, it } from "vitest";
import { gameweekResultsEmail, predictionReminderEmail } from "./email-templates.js";

describe("notification email templates", () => {
  it("builds a branded prediction reminder with a prominent dashboard CTA", () => {
    const email = predictionReminderEmail({
      roundNumber: 7,
      hoursBeforeDeadline: 2,
      recipientName: "Alex",
      dashboardUrl: "https://ultimatefpl-cffba.web.app/dashboard",
    });

    expect(email.subject).toContain("2 hours left");
    expect(email.html).toContain("Predictions Premier League");
    expect(email.html).toContain("Make my predictions");
    expect(email.html).toContain('href="https://ultimatefpl-cffba.web.app/dashboard"');
    expect(email.html).not.toContain("Back your best prediction");
    expect(email.html).not.toContain("Your matchday checklist");
  });

  it("builds distinct copy for the 24-hour prediction reminder", () => {
    const email = predictionReminderEmail({
      roundNumber: 7,
      hoursBeforeDeadline: 24,
      recipientName: "Alex",
      dashboardUrl: "https://ultimatefpl-cffba.web.app/dashboard",
    });

    expect(email.subject).toContain("24 hours left");
    expect(email.html).toContain("One day to go");
    expect(email.text).toContain("Only 24 hours remain");
  });

  it("builds a results email with personalized copy and an updated-table CTA", () => {
    const email = gameweekResultsEmail({
      roundNumber: 8,
      recipientName: "Sam",
      dashboardUrl: "https://ultimatefpl-cffba.web.app/dashboard",
    });

    expect(email.subject).toContain("see how you ranked");
    expect(email.html).toContain("Hi Sam,");
    expect(email.html).toContain("Check Results");
    expect(email.html).not.toContain("Then check the updated tables");
    expect(email.html).not.toContain("Your gameweek recap");
    expect(email.text).toContain("updated league positions");
  });

  it("escapes recipient names and dashboard URLs before adding them to HTML", () => {
    const email = predictionReminderEmail({
      roundNumber: 9,
      hoursBeforeDeadline: 2,
      recipientName: '<script>alert("x")</script>',
      dashboardUrl: "https://example.com/dashboard?one=1&two=2",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("one=1&amp;two=2");
  });
});
