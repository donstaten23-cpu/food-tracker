import { round } from '../lib/nutrition'

const RADIUS = 84
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CalorieRing({ eaten, target }) {
  const progress = target > 0 ? Math.min(1, eaten / target) : 0
  const remaining = target - eaten
  const over = remaining < 0

  return (
    <div className="calorie-ring">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${round(Math.abs(remaining))} calories ${over ? 'over' : 'remaining'}`}
      >
        <circle className="ring-track" cx="100" cy="100" r={RADIUS} />
        <circle
          className="ring-progress"
          cx="100"
          cy="100"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-value">{round(Math.abs(remaining))}</span>
        <span className="ring-label">{over ? 'Over' : 'Remaining'}</span>
        <span className="ring-sub">
          {round(eaten)} / {round(target)} cal
        </span>
      </div>
    </div>
  )
}

function MacroBar({ label, value, target }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="macro">
      <span className="macro-label">{label}</span>
      <div className="macro-track">
        <div className="macro-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="macro-value">
        {round(value)} / {round(target)}g
      </span>
    </div>
  )
}

export default function TargetBar({ totals, target }) {
  if (!target) return null
  return (
    <div className="calorie-card">
      <CalorieRing eaten={totals.calories} target={target.calories} />
      <div className="macro-row">
        <MacroBar label="Protein" value={totals.protein_g} target={target.protein_g} />
        <MacroBar label="Carbs" value={totals.carbs_g} target={target.carbs_g} />
        <MacroBar label="Fat" value={totals.fat_g} target={target.fat_g} />
      </div>
    </div>
  )
}
