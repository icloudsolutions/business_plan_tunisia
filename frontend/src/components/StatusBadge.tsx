const LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  UNDER_REVIEW: "En revue",
  ADJUSTMENT: "Ajustement",
  VALIDATED: "Validé",
};

export default function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/_/g, "-");
  return (
    <span className={`status-badge status-${key}`}>
      {LABELS[status] || status}
    </span>
  );
}
