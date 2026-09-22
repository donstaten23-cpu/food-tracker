import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { round } from '../lib/nutrition'

// Same food = same name + brand, ignoring case (matches the CSV import).
const foodKey = (name, brand) => `${name.trim().toLowerCase()}|${(brand || '').trim().toLowerCase()}`

const toForm = (food) => ({
  name: food.name,
  brand: food.brand || '',
  serving_qty: food.serving_qty,
  serving_unit: food.serving_unit,
  calories: food.calories,
  protein_g: food.protein_g,
  carbs_g: food.carbs_g,
  fat_g: food.fat_g,
})

export default function FoodRow({ food, allFoods, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function startEdit() {
    setForm(toForm(food))
    setError('')
    setEditing(true)
  }

  async function save(e) {
    e.preventDefault()

    const name = form.name.trim()
    if (!name) return setError('Name is required.')
    if (String(form.calories).trim() === '') return setError('Calories is required.')

    const nums = {
      serving_qty: Number(form.serving_qty),
      calories: Number(form.calories),
      protein_g: Number(form.protein_g || 0),
      carbs_g: Number(form.carbs_g || 0),
      fat_g: Number(form.fat_g || 0),
    }
    if (Object.values(nums).some((n) => Number.isNaN(n) || n < 0)) {
      return setError('Quantity, calories and macros must be numbers, zero or more.')
    }
    if (nums.serving_qty <= 0) return setError('Quantity must be more than 0.')

    const key = foodKey(name, form.brand)
    if (allFoods.some((f) => f.id !== food.id && foodKey(f.name, f.brand) === key)) {
      return setError('You already have a food with that name and brand.')
    }

    setBusy(true)
    setError('')
    const { data, error: updateErr } = await supabase
      .from('foods')
      .update({
        name,
        brand: form.brand.trim() || null,
        serving_unit: form.serving_unit.trim() || 'serving',
        ...nums,
      })
      .eq('id', food.id)
      .select('id')
    setBusy(false)

    if (updateErr) return setError(updateErr.message)
    if (!data?.length) return setError("Couldn't save. This food may have been deleted.")
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!window.confirm(`Delete "${food.name}"? Past log entries keep their numbers.`)) return

    setBusy(true)
    setError('')
    const { data, error: deleteErr } = await supabase.from('foods').delete().eq('id', food.id).select('id')
    setBusy(false)

    if (deleteErr) return setError(deleteErr.message)
    // RLS can filter the delete down to zero rows without raising an error.
    if (!data?.length) {
      return setError(
        "Couldn't delete this food. If someone else added it, run migration 0004 in Supabase so either of you can delete shared foods."
      )
    }
    onChanged()
  }

  if (!editing) {
    return (
      <li className="food-row">
        <div className="food-info">
          <span>
            {food.name}
            {food.brand ? <span className="muted small"> ({food.brand})</span> : null}
          </span>
          <span className="muted small">
            {round(food.calories)} cal per {food.serving_qty} {food.serving_unit} · P {round(food.protein_g)}g · C{' '}
            {round(food.carbs_g)}g · F {round(food.fat_g)}g
          </span>
        </div>
        <button type="button" className="secondary food-edit-btn" onClick={startEdit}>
          Edit
        </button>
      </li>
    )
  }

  return (
    <li className="food-row editing">
      <form className="food-edit-form" onSubmit={save}>
        <label>
          Name
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label>
          Brand (optional)
          <input value={form.brand} onChange={set('brand')} />
        </label>
        <div className="field-row">
          <label>
            Quantity
            <input type="number" step="any" value={form.serving_qty} onChange={set('serving_qty')} required />
          </label>
          <label>
            Unit
            <input value={form.serving_unit} onChange={set('serving_unit')} />
          </label>
        </div>
        <div className="field-row">
          <label>
            Calories
            <input type="number" step="any" value={form.calories} onChange={set('calories')} required />
          </label>
          <label>
            Protein (g)
            <input type="number" step="any" value={form.protein_g} onChange={set('protein_g')} />
          </label>
        </div>
        <div className="field-row">
          <label>
            Carbs (g)
            <input type="number" step="any" value={form.carbs_g} onChange={set('carbs_g')} />
          </label>
          <label>
            Fat (g)
            <input type="number" step="any" value={form.fat_g} onChange={set('fat_g')} />
          </label>
        </div>

        <p className="muted small">
          Numbers are per the quantity above. Changes apply to future logging; entries you've already logged keep
          the numbers they had.
        </p>
        {error && <p className="error">{error}</p>}

        <div className="food-edit-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        </div>
      </form>
    </li>
  )
}
