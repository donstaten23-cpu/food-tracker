import { round } from '../lib/nutrition'

function Bar({ label, value, target, unit }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target
  return (
    <div className="target-bar">
      <div className="target-bar-label">
        <span>{label}</span>
        <span className={over ? 'over' : ''}>
          {round(value)} / {round(target)} {unit}
        </span>
      </div>
      <div className="target-bar-track">
        <div
          className={`target-bar-fill${over ? ' over' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function TargetBar({ totals, target }) {
  if (!target) return null
  return (
    <div className="target-bars">
      <Bar label="Calories" value={totals.calories} target={target.calories} unit="cal" />
      <Bar label="Protein" value={totals.protein_g} target={target.protein_g} unit="g" />
      <Bar label="Carbs" value={totals.carbs_g} target={target.carbs_g} unit="g" />
      <Bar label="Fat" value={totals.fat_g} target={target.fat_g} unit="g" />
    </div>
  )
}
