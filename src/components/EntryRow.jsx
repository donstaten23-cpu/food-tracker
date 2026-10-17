import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { round } from '../lib/nutrition'

// One logged entry. The edit (pencil) button lets you fix the amount after
// the fact — every macro scales with it, same ratio it was logged at.
export default function EntryRow({ entry, onChanged, onRepeat, repeated, showMealType }) {
  const [editing, setEditing] = useState(false)
  const [quantity, setQuantity] = useState(entry.quantity)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit() {
    setQuantity(entry.quantity)
    setError('')
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    const newQty = Number(quantity)
    if (!(newQty > 0)) return setError('Amount must be more than 0.')

    const ratio = newQty / Number(entry.quantity || 1)
    setSaving(true)
    setError('')
    const { error: updateErr } = await supabase
      .from('food_entries')
      .update({
        quantity: newQty,
        calories: Number(entry.calories || 0) * ratio,
        protein_g: Number(entry.protein_g || 0) * ratio,
        carbs_g: Number(entry.carbs_g || 0) * ratio,
        fat_g: Number(entry.fat_g || 0) * ratio,
        fiber_g: Number(entry.fiber_g || 0) * ratio,
      })
      .eq('id', entry.id)
    setSaving(false)
    if (updateErr) return setError(updateErr.message)
    setEditing(false)
    onChanged()
  }

  async function handleDelete() {
    await supabase.from('food_entries').delete().eq('id', entry.id)
    onChanged()
  }

  if (editing) {
    return (
      <li className="entry-editing">
        <form onSubmit={saveEdit} className="entry-editing-form">
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
            required
          />
          <span className="muted small">
            {entry.unit} {entry.description}
          </span>
          <button type="submit" className="small" disabled={saving}>
            {saving ? '…' : 'Save'}
          </button>
          <button type="button" className="secondary small" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </form>
        {error && <p className="error small">{error}</p>}
      </li>
    )
  }

  return (
    <li>
      <span>
        {showMealType && `[${entry.meal_type}] `}
        {entry.quantity} {entry.unit} {entry.description}
      </span>
      <span className="entry-right">
        <span className="muted">
          {round(entry.calories)} cal · C {round(entry.carbs_g)}g
        </span>
        {onRepeat &&
          (repeated ? (
            <span className="muted small">Added to today</span>
          ) : (
            <button type="button" className="secondary small" onClick={() => onRepeat(entry)}>
              Repeat
            </button>
          ))}
        <button type="button" className="icon-button small" onClick={startEdit} aria-label="Edit amount">
          ✎
        </button>
        <button type="button" className="icon-button small" onClick={handleDelete} aria-label="Delete">
          ×
        </button>
      </span>
    </li>
  )
}
