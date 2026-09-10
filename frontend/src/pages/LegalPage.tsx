import type { ReactNode } from "react";
import { APP_NAME } from "../brand";
import { BrandLogo } from "../components/BrandLogo";
import { LegalLinks } from "../components/LegalLinks";

const EFFECTIVE_DATE = "September 10, 2026";
const CONTACT_EMAIL = "urjitdesai07@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section>
    <h2>{title}</h2>
    {children}
  </section>;
}

function LegalLayout({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <main className="legal-page">
    <header className="legal-header">
      <a className="legal-brand" href="/" aria-label={`${APP_NAME} home`}><BrandLogo /><span>{APP_NAME}</span></a>
    </header>
    <article className="legal-document">
      <div className="legal-title">
        <a className="legal-back-link" href="/">← Back to home</a>
        <span>Legal</span>
        <h1>{title}</h1>
        <p>{summary}</p>
        <small>Effective date: <time dateTime="2026-09-10">{EFFECTIVE_DATE}</time></small>
      </div>
      <div className="legal-content">{children}</div>
    </article>
    <footer className="legal-footer">
      <p>Independent prediction game. Not affiliated with the Premier League or its clubs.</p>
      <LegalLinks />
    </footer>
  </main>;
}

export function TermsPage() {
  return <LegalLayout title="Terms and Conditions" summary="The rules for using Ultimate FPL and taking part in the prediction game.">
    <Section title="1. About these terms">
      <p>These Terms and Conditions govern your access to and use of {APP_NAME}, including its website, leagues, predictions, scoring, virtual points, wagers and related communications (the “Service”). By creating an account or using the Service, you agree to these terms. If you do not agree, do not use the Service.</p>
      <p>The Service is an independent football prediction game operated as Ultimate FPL. It is not sponsored by, endorsed by, administered by or affiliated with the Premier League, any football club, competition or governing body.</p>
    </Section>

    <Section title="2. Eligibility and accounts">
      <p>You must be at least 13 years old, or the minimum age required to use an online service in your country. If you are under the age of legal majority, you must have permission from a parent or guardian.</p>
      <p>You must provide accurate information, keep your login credentials secure and promptly notify us if you believe your account has been compromised. You are responsible for activity carried out through your account. One person should not create multiple accounts to manipulate a league or its results.</p>
    </Section>

    <Section title="3. How the game works">
      <p>You may submit score predictions before the displayed gameweek deadline. Predictions that are not successfully submitted before that deadline may not count. Points are awarded under the scoring rules shown in the Service. Captain selections, league standings and virtual-point wagers are also governed by the rules displayed in the relevant part of the Service.</p>
      <p>Fixture information and results may come from third-party data providers. We may correct fixtures, results, points or standings when data is delayed, incomplete or inaccurate. Our reasonable decision about scoring and corrections is final.</p>
    </Section>

    <Section title="4. No real-money gambling">
      <p>The Service is free to play. Points, balances, wagers and rewards shown in the Service are entirely virtual, have no monetary value and cannot be purchased, withdrawn, transferred or exchanged for money or anything of value. The Service does not offer real-money betting or gambling.</p>
    </Section>

    <Section title="5. Acceptable use">
      <p>You must not misuse the Service. This includes attempting to gain unauthorized access, disrupting the Service, using automated tools to scrape or overload it, manipulating predictions or standings, impersonating another person, uploading malicious material, or using the Service for unlawful, abusive or fraudulent activity.</p>
      <p>We may restrict or close accounts that breach these terms, threaten the integrity of the game or put other users or the Service at risk.</p>
    </Section>

    <Section title="6. Intellectual property">
      <p>The Service’s original software, design, text and branding belong to us or our licensors and are protected by applicable intellectual-property laws. You may use the Service only for personal, non-commercial participation in the game.</p>
      <p>Club names, competition names, badges and other third-party marks belong to their respective owners. Their appearance is for identification and informational purposes and does not imply affiliation or endorsement.</p>
    </Section>

    <Section title="7. Availability and changes">
      <p>We aim to keep the Service available and accurate, but we do not guarantee uninterrupted or error-free operation. Matches may be postponed, data providers may be delayed and maintenance may be required. We may update, suspend or discontinue features when reasonably necessary.</p>
    </Section>

    <Section title="8. Disclaimers and liability">
      <p>The Service is provided on an “as is” and “as available” basis. To the extent permitted by law, we exclude implied warranties and are not responsible for indirect, incidental or consequential losses arising from use of the Service, unavailable features, lost predictions or third-party data errors.</p>
      <p>Nothing in these terms excludes liability that cannot legally be excluded or limits any mandatory consumer rights available to you.</p>
    </Section>

    <Section title="9. Privacy and communications">
      <p>Our <a href="/privacy">Privacy Policy</a> explains how we handle personal information. We may send service messages and, when enabled, gameweek reminders and results emails. You can opt out of optional notification emails by contacting us.</p>
    </Section>

    <Section title="10. Changes to these terms">
      <p>We may update these terms as the Service or applicable requirements change. We will publish the updated version here and change the effective date. If a change materially affects your rights, we will provide reasonable notice where appropriate.</p>
    </Section>

    <Section title="11. Contact">
      <p>Questions about these terms can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </Section>
  </LegalLayout>;
}

export function PrivacyPage() {
  return <LegalLayout title="Privacy Policy" summary="How Ultimate FPL collects, uses and protects information about you.">
    <Section title="1. Who we are">
      <p>Ultimate FPL operates {APP_NAME} (the “Service”). This Privacy Policy explains how we handle personal information when you visit the website, create an account, submit predictions, join leagues or receive game notifications.</p>
      <p>For questions or privacy requests, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </Section>

    <Section title="2. Information we collect">
      <ul>
        <li><strong>Account information:</strong> email address, first and last name, manager name, username, favourite team and authentication identifiers.</li>
        <li><strong>Game information:</strong> predictions, captain selections, league membership, scores, rankings, virtual-point balances and virtual wagers.</li>
        <li><strong>Communications:</strong> email-notification preferences and records needed to send or troubleshoot service emails.</li>
        <li><strong>Technical information:</strong> IP address, device and browser information, authentication data, diagnostic logs and security or rate-limiting events generated when you use the Service.</li>
      </ul>
    </Section>

    <Section title="3. How we use information">
      <p>We use information to create and secure accounts, operate predictions and leagues, calculate scores and standings, display player profiles within leagues, send requested gameweek communications, maintain and improve the Service, investigate abuse, enforce our terms and comply with legal obligations.</p>
      <p>Where applicable, we rely on performance of our agreement with you, our legitimate interests in operating and protecting the Service, your consent for optional communications or advertising technologies, and compliance with legal obligations.</p>
    </Section>

    <Section title="4. When information is shared">
      <p>Manager names, usernames, favourite teams, predictions, points and rankings may be visible to other members of leagues you join. We also use service providers that process information on our behalf, including Google Firebase Authentication, Cloud Firestore, Firebase Hosting, Cloud Run and Google email services.</p>
      <p>We may disclose information when required by law, to protect users or the Service, or as part of a merger, financing or transfer of the Service. We do not sell personal information for money.</p>
    </Section>

    <Section title="5. Cookies, local storage and advertising">
      <p>The Service uses cookies or similar browser storage where necessary to keep you signed in, protect accounts and remember essential state. We may introduce Google AdSense or a similar provider to display advertising. If advertising is enabled, advertising partners may use cookies or similar technologies to deliver, limit, personalize and measure ads, subject to your consent where required.</p>
      <p>You will be given appropriate privacy and cookie choices before non-essential advertising technologies are used in regions where consent is required.</p>
    </Section>

    <Section title="6. Retention">
      <p>We keep account and game information for as long as your account remains active and as reasonably needed to operate league history, resolve disputes, prevent abuse and meet legal obligations. Technical logs and email-delivery records are retained only for a reasonable operational period. We may retain aggregated or anonymized information that no longer identifies you.</p>
    </Section>

    <Section title="7. Security">
      <p>We use reasonable technical and organizational safeguards designed to protect personal information. No online system is completely secure, so we cannot guarantee absolute security. You should use a strong, unique password and protect access to your email account.</p>
    </Section>

    <Section title="8. Your choices and rights">
      <p>You may ask to access, correct or delete your personal information, update your profile details, or change your notification preferences by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address associated with your account. We may need to verify your identity before completing a request.</p>
      <p>Depending on where you live, you may also have rights to restrict or object to processing, receive a portable copy of information, withdraw consent, or complain to your local data-protection authority. Withdrawing consent does not affect processing that already occurred lawfully.</p>
    </Section>

    <Section title="9. International processing">
      <p>Our providers may process information in countries other than the one where you live. Where required, we rely on appropriate safeguards for international transfers of personal information.</p>
    </Section>

    <Section title="10. Children’s privacy">
      <p>The Service is not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has provided personal information without appropriate permission, contact us so we can investigate and delete it where required.</p>
    </Section>

    <Section title="11. Changes to this policy">
      <p>We may update this policy as the Service or applicable requirements change. We will publish the updated version here and revise the effective date. We will provide additional notice when a material change requires it.</p>
    </Section>
  </LegalLayout>;
}
