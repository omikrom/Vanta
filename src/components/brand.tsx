export function VantaMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="vanta-brand" aria-label="Vanta">
      <span className="vanta-mark" aria-hidden="true"><i /><i /></span>
      {!compact && <span className="vanta-wordmark">VANTA</span>}
    </span>
  );
}
