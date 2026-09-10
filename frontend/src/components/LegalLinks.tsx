export function LegalLinks({ className = "" }: { className?: string }) {
  const classes = ["legal-links", className].filter(Boolean).join(" ");

  return <nav className={classes} aria-label="Legal information">
    <a href="/terms">Terms and Conditions</a>
    <span aria-hidden="true">·</span>
    <a href="/privacy">Privacy Policy</a>
  </nav>;
}
