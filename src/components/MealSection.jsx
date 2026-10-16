import { round, sumTotals } from '../lib/nutrition'
import EntryRow from './EntryRow'

export default function MealSection({ label, entries, onAdd, onChanged }) {
  const totals = sumTotals(entries)

  return (
    <section className="meal-section">
      <div className="meal-header">
        <h3>{label}</h3>
        <span className="muted">{entries.length > 0 ? `${round(totals.calories)} cal` : ''}</span>
      </div>

      {entries.length > 0 && (
        <ul className="entry-list">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onChanged={onChanged} />
          ))}
        </ul>
      )}

      <button className="add-entry-button" onClick={onAdd}>
        + Add to {label.toLowerCase()}
      </button>
    </section>
  )
}
