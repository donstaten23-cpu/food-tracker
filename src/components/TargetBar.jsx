import { round, netCarbs } from '../lib/nutrition'

function StatBar({ className, label, value, target, unit }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className={`stat-bar ${className}`}>
      <div className="stat-bar-row">
        <span className="stat-bar-label">
          {label} - {round(value)} / {round(target)} {unit}
        </span>
        <span className="stat-bar-pct">{Math.round(pct)}%</span>
      </div>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function TargetBar({ totals, target }) {
  if (!target) return null
  return (
    <div className="target-card">
      <StatBar className="stat-energy" label="Energy" value={totals.calories} target={target.calories} unit="kcal" />
      <StatBar className="stat-protein" label="Protein" value={totals.protein_g} target={target.protein_g} unit="g" />
      <StatBar
        className="stat-carbs"
        label="Net Carbs"
        value={netCarbs(totals)}
        target={target.carbs_g}
        unit="g"
      />
      <StatBar className="stat-fat" label="Fat" value={totals.fat_g} target={target.fat_g} unit="g" />
    </div>
  )
}
