import { useEffect, useState } from 'react'
import { supabase, estimateFood } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { round, todayIso } from '../lib/nutrition'

const EMPTY_EXACT = { name: '', brand: '', quantity: 1, unit: 'serving', calories: '', protein_g: '', carbs_g: '', fat_g: '' }

export default function AddEntryModal({ mealType, onClose, onLogged }) {
  const { user, household } = useAuth()
  const [tab, setTab] = useState('describe')

  // --- describe tab ---
  const [description, setDescription] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')

  // --- exact tab ---
  const [exact, setExact] = useState(EMPTY_EXACT)

  // --- quick add tab ---
  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tab !== 'quick') return
    setFavoritesLoading(true)
    supabase
      .from('foods')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setFavorites(data || [])
        setFavoritesLoading(false)
      })
  }, [tab, household.id])

  async function handleEstimate() {
    if (!description.trim()) return
    setEstimating(true)
    setEstimateError('')
    setEstimate(null)
    try {
      const result = await estimateFood(description.trim())
      setEstimate(result)
    } catch (e) {
      setEstimateError(e.message)
    } finally {
      setEstimating(false)
    }
  }

  // Inserts one foods row (catalog, so it can be quick-added later) plus one
  // food_entries row per item, all sharing the same meal/date.
  async function saveItems(items, source) {
    setSaving(true)
    try {
      for (const item of items) {
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
            source,
          })
          .select()
          .single()
        if (foodErr) throw foodErr

        const { error: entryErr } = await supabase.from('food_entries').insert({
          household_id: household.id,
          user_id: user.id,
          food_id: food.id,
          logged_date: todayIso(),
          meal_type: mealType,
          description: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source,
        })
        if (entryErr) throw entryErr
      }
      onLogged()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEstimate() {
    if (!estimate) return
    await saveItems(estimate.items, 'estimated')
  }

  async function handleSaveExact(e) {
    e.preventDefault()
    await saveItems(
      [
        {
          name: exact.name,
          quantity: Number(exact.quantity) || 1,
          unit: exact.unit,
          calories: Number(exact.calories) || 0,
          protein_g: Number(exact.protein_g) || 0,
          carbs_g: Number(exact.carbs_g) || 0,
          fat_g: Number(exact.fat_g) || 0,
        },
      ],
      'exact'
    )
  }

  async function handleQuickAdd(food) {
    await saveItems(
      [
        {
          name: food.name,
          quantity: food.serving_qty,
          unit: food.serving_unit,
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
        },
      ],
      food.source
    )
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
          <button className={tab === 'describe' ? 'active' : ''} onClick={() => setTab('describe')}>
            Describe it
          </button>
          <button className={tab === 'quick' ? 'active' : ''} onClick={() => setTab('quick')}>
            Quick add
          </button>
          <button className={tab === 'exact' ? 'active' : ''} onClick={() => setTab('exact')}>
            Exact entry
          </button>
        </div>

        {tab === 'describe' && (
          <div className="tab-panel">
            <textarea
              rows={3}
              placeholder="e.g. two scrambled eggs and a slice of buttered toast"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button onClick={handleEstimate} disabled={estimating || !description.trim()}>
              {estimating ? 'Estimating…' : 'Estimate'}
            </button>
            {estimateError && <p className="error">{estimateError}</p>}

            {estimate && (
              <div className="estimate-preview">
                {estimate.items.map((item, i) => (
                  <div className="estimate-item" key={i}>
                    <span>
                      {item.quantity} {item.unit} {item.name}
                    </span>
                    <span className="muted">{round(item.calories)} cal</span>
                  </div>
                ))}
                <div className="estimate-total">
                  <span>Total</span>
                  <span>
                    {round(estimate.total.calories)} cal · P {round(estimate.total.protein_g)}g · C{' '}
                    {round(estimate.total.carbs_g)}g · F {round(estimate.total.fat_g)}g
                  </span>
                </div>
                {estimate.notes && <p className="muted small">{estimate.notes}</p>}
                <button onClick={handleSaveEstimate} disabled={saving}>
                  {saving ? 'Saving…' : `Log to ${mealType}`}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'quick' && (
          <div className="tab-panel">
            {favoritesLoading && <p className="muted">Loading…</p>}
            {!favoritesLoading && favorites.length === 0 && (
              <p className="muted">Nothing logged yet — items you log show up here for quick re-adding.</p>
            )}
            <div className="favorites-list">
              {favorites.map((food) => (
                <button key={food.id} className="favorite-row" onClick={() => handleQuickAdd(food)} disabled={saving}>
                  <span>
                    {food.name}
                    <span className="muted small">
                      {' '}
                      · {food.serving_qty} {food.serving_unit}
                    </span>
                  </span>
                  <span className="muted">{round(food.calories)} cal</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'exact' && (
          <form className="tab-panel" onSubmit={handleSaveExact}>
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
