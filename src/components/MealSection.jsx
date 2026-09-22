import { round, sumTotals } from '../lib/nutrition'
import { supabase } from '../lib/supabaseClient'

export default function MealSection({ label, entries, onAdd, onChanged }) {
  const totals = sumTotals(entries)

  async function handleDelete(id) {
    await supabase.from('food_entries').delete().eq('id', id)
    onChanged()
  }

  return (
    <section className="meal-section">
      <div className="meal-header">
        <h3>{label}</h3>
        <span className="muted">{entries.length > 0 ? `${round(totals.calories)} cal` : ''}</span>
      </div>

      {entries.length > 0 && (
        <ul className="entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <span>
                {e.quantity} {e.unit} {e.description}
              </span>
              <span className="entry-right">
                <span className="muted">
                  {round(e.calories)} cal · C {round(e.carbs_g)}g
                </span>
                <button className="icon-button small" onClick={() => handleDelete(e.id)} aria-label="Delete">
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="add-entry-button" onClick={onAdd}>
        + Add to {label.toLowerCase()}
      </button>
    </section>
  )
}
