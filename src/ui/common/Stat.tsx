export function Stat({
  label,
  value,
  unit,
  testId,
}: {
  label: string
  value: string
  unit?: string
  testId?: string
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        <span data-testid={testId}>{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  )
}
