type Props = {
  label: string;
  compact?: boolean;
};

export function LoadingIndicator({ label, compact = false }: Props) {
  return <span className={`loading-indicator ${compact ? "is-compact" : ""}`} role="status" aria-live="polite">
    <span className="loading-spinner" aria-hidden="true" />
    <span>{label}</span>
  </span>;
}
