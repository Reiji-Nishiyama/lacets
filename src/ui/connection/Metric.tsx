export function Metric({
  label,
  value,
  unit,
  testId,
}: {
  label: string
  value: number | null | undefined
  unit: string
  testId?: string
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <span data-testid={testId}>{value == null ? '—' : Math.round(value)}</span>
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  )
}
