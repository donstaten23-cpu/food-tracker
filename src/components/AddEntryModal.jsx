import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { round, todayIso } from '../lib/nutrition'

const EMPTY_EXACT = { name: '', brand: '', quantity: 1, unit: 'serving', calories: '', protein_g: '', carbs_g: '', fat_g: '' }

export default function AddEntryModal({ mealType, onClose, onLogged }) {
  const { user, household } = useAuth()
  const [tab, setTab] = useState('quick')

  // --- new food tab ---
  const [exact, setExact] = useState(EMPTY_EXACT)

  // --- quick add tab ---
  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState({}) // food.id -> quantity typed in

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tab !== 'quick') return
    setFavoritesLoading(true)
    supabase
      .from('foods')
      .select('*')
      .eq('household_id', household.id)
      .order('last_used_at', { ascending: false })
      .order('name', { ascending: true })
      .limit(1000)
      .then(({ data }) => {
        setFavorites(data || [])
        setFavoritesLoading(false)
      })
  }, [tab, household.id])

  const filteredFavorites = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return favorites
    return favorites.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q)
    )
  }, [favorites, search])

  // Writes one food_entries row (the log line for today). Macros are copied
  // in so later edits to a preset never rewrite history.
  async function logEntry(item, foodId) {
    const { error: entryErr } = await supabase.from('food_entries').insert({
      household_id: household.id,
      user_id: user.id,
      food_id: foodId,
      logged_date: todayIso(),
      meal_type: mealType,
      description: item.name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      source: 'exact',
    })
    if (entryErr) throw entryErr
  }

  // Runs a save, shows any failure in the modal instead of swallowing it, and
  // closes the modal only on success.
  async function run(action) {
    setSaving(true)
    setError('')
    try {
      await action()
      onLogged()
    } catch (err) {
      setError(err.message || 'Something went wrong. Nothing was saved.')
    } finally {
      setSaving(false)
    }
  }

  // "New food": adds the preset to the catalog AND logs it once. Only this
  // path creates catalog rows — Quick add reuses the existing one.
  function saveNewFood(item) {
    return run(async () => {
      const { data: food, error: foodErr } = await supabase
        .from('foods')
        .insert({
          household_id: household.id,
          created_by: user.id,
          name: item.name,
          brand: item.brand || null,
          serving_qty: item.quantity,
          serving_unit: item.unit,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: 'exact',
        })
        .select()
        .single()
      if (foodErr) throw foodErr
      await logEntry(item, food.id)
    })
  }

  function handleSaveExact(e) {
    e.preventDefault()
    return saveNewFood({
      name: exact.name.trim(),
      quantity: Number(exact.quantity) || 1,
      unit: exact.unit,
      calories: Number(exact.calories) || 0,
      protein_g: Number(exact.protein_g) || 0,
      carbs_g: Number(exact.carbs_g) || 0,
      fat_g: Number(exact.fat_g) || 0,
    })
  }

  // Logs a preset food, scaling its stored macros if the user changed the
  // quantity (e.g. "usually 1 banana" but logging 2 today).
  function handleQuickAdd(food) {
    const qty = Number(quantities[food.id] ?? food.serving_qty) || food.serving_qty
    const ratio = qty / (food.serving_qty || 1)

    return run(async () => {
      await logEntry(
        {
          name: food.name,
          quantity: qty,
          unit: food.serving_unit,
          calories: food.calories * ratio,
          protein_g: food.protein_g * ratio,
          carbs_g: food.carbs_g * ratio,
          fat_g: food.fat_g * ratio,
        },
        food.id
      )
      // Bumps it to the top of Quick add next time. Best-effort: the entry is
      // already saved, so a failure here is deliberately not surfaced.
      await supabase.from('foods').update({ last_used_at: new Date().toISOString() }).eq('id', food.id)
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log food</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="tabs">
          <button className={tab === 'quick' ? 'active' : ''} onClick={() => setTab('quick')}>
            Quick add
          </button>
          <button className={tab === 'exact' ? 'active' : ''} onClick={() => setTab('exact')}>
            New food
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {tab === 'quick' && (
          <div className="tab-panel">
            {favorites.length > 0 && (
              <input
                placeholder="Search your foods…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            {favoritesLoading && <p className="muted">Loading…</p>}
            {!favoritesLoading && favorites.length === 0 && (
              <p className="muted">
                Nothing preset yet — add something under "New food" and it'll show up here for
                one-tap logging every time after. Have a list already? Import a CSV in Settings.
              </p>
            )}
            {!favoritesLoading && favorites.length > 0 && filteredFavorites.length === 0 && (
              <p className="muted">No match — add it under "New food".</p>
            )}
            <div className="favorites-list">
              {filteredFavorites.map((food) => (
                <div key={food.id} className="favorite-row">
                  <div className="favorite-info">
                    <span>
                      {food.name}
                      {food.brand ? <span className="muted small"> ({food.brand})</span> : null}
                    </span>
                    <span className="muted small">
                      {round(food.calories)} cal per {food.serving_qty} {food.serving_unit}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    className="favorite-qty"
                    value={quantities[food.id] ?? food.serving_qty}
                    onChange={(e) => setQuantities({ ...quantities, [food.id]: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={() => handleQuickAdd(food)} disabled={saving}>
                    Log
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'exact' && (
          <form className="tab-panel" onSubmit={handleSaveExact}>
            <p className="muted small">
              Enter the numbers once (from a label, a recipe, or wherever you look it up) — it's
              saved to Quick add for every time after.
            </p>
            <label>
              Name
              <input value={exact.name} onChange={(e) => setExact({ ...exact, name: e.target.value })} required />
            </label>
            <div className="field-row">
              <label>
                Quantity
                <input
                  type="number"
                  step="any"
                  value={exact.quantity}
                  onChange={(e) => setExact({ ...exact, quantity: e.target.value })}
                  required
                />
              </label>
              <label>
                Unit
                <input value={exact.unit} onChange={(e) => setExact({ ...exact, unit: e.target.value })} placeholder="g, oz, cup…" required />
              </label>
            </div>
            <div className="field-row">
              <label>
                Calories
                <input type="number" step="any" value={exact.calories} onChange={(e) => setExact({ ...exact, calories: e.target.value })} required />
              </label>
              <label>
                Protein (g)
                <input type="number" step="any" value={exact.protein_g} onChange={(e) => setExact({ ...exact, protein_g: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label>
                Carbs (g)
                <input type="number" step="any" value={exact.carbs_g} onChange={(e) => setExact({ ...exact, carbs_g: e.target.value })} />
              </label>
              <label>
                Fat (g)
                <input type="number" step="any" value={exact.fat_g} onChange={(e) => setExact({ ...exact, fat_g: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : `Log to ${mealType}`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
