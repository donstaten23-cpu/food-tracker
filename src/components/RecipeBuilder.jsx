import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { round, scaleMacros, sumMacros } from '../lib/nutrition'

// Turns a recipe_ingredients row (or a freshly-added ingredient) into the
// flat shape this form works with.
const toIngredient = (row) => ({
  key: row.id || crypto.randomUUID(),
  food_id: row.food_id ?? null,
  name: row.name,
  quantity: row.quantity,
  unit: row.unit,
  calories: row.calories,
  protein_g: row.protein_g,
  carbs_g: row.carbs_g,
  fat_g: row.fat_g,
  fiber_g: row.fiber_g,
})

export default function RecipeBuilder({ recipe, onClose, onSaved }) {
  const { user, household } = useAuth()
  const editing = Boolean(recipe)

  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? 1)
  const [ingredients, setIngredients] = useState(
    (recipe?.recipe_ingredients ?? []).map(toIngredient)
  )

  const [foods, setFoods] = useState([])
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState({}) // food.id -> quantity typed in

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('foods')
      .select('*')
      .eq('household_id', household.id)
      .order('name', { ascending: true })
      .limit(1000)
      .then(({ data }) => setFoods(data || []))
  }, [household.id])

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return foods
    return foods.filter((f) => f.name.toLowerCase().includes(q))
  }, [foods, search])

  const totals = sumMacros(ingredients)
  const perServing = scaleMacros(totals, 1 / (Number(servings) || 1))

  function addIngredient(food) {
    const qty = Number(quantities[food.id] ?? food.serving_qty) || food.serving_qty
    const ratio = qty / (food.serving_qty || 1)
    setIngredients((prev) => [
      ...prev,
      toIngredient({
        food_id: food.id,
        name: food.name,
        quantity: qty,
        unit: food.serving_unit,
        ...scaleMacros(food, ratio),
      }),
    ])
  }

  function removeIngredient(key) {
    setIngredients((prev) => prev.filter((i) => i.key !== key))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    if (ingredients.length === 0) return setError('Add at least one ingredient.')
    if (!(Number(servings) > 0)) return setError('Servings must be more than 0.')

    setSaving(true)
    setError('')
    try {
      let recipeId = recipe?.id
      if (editing) {
        const { error: updateErr } = await supabase
          .from('recipes')
          .update({ name: name.trim(), servings: Number(servings) })
          .eq('id', recipeId)
        if (updateErr) throw updateErr
        const { error: delErr } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
        if (delErr) throw delErr
      } else {
        const { data, error: insertErr } = await supabase
          .from('recipes')
          .insert({
            household_id: household.id,
            created_by: user.id,
            name: name.trim(),
            servings: Number(servings),
          })
          .select()
          .single()
        if (insertErr) throw insertErr
        recipeId = data.id
      }

      const rows = ingredients.map(({ key: _key, ...ing }) => ({
        ...ing,
        recipe_id: recipeId,
        household_id: household.id,
      }))
      const { error: ingErr } = await supabase.from('recipe_ingredients').insert(rows)
      if (ingErr) throw ingErr

      onSaved()
    } catch (err) {
      setError(err.message || 'Something went wrong. Nothing was saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editing ? 'Edit recipe' : 'New recipe'}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <form className="tab-panel" onSubmit={handleSave}>
          <div className="field-row">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Servings
              <input
                type="number"
                step="any"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                required
              />
            </label>
          </div>

          <h3>Ingredients</h3>
          {ingredients.length === 0 && <p className="muted small">Nothing added yet.</p>}
          {ingredients.length > 0 && (
            <ul className="entry-list">
              {ingredients.map((ing) => (
                <li key={ing.key}>
                  <span>
                    {ing.quantity} {ing.unit} {ing.name}
                  </span>
                  <span className="entry-right">
                    <span className="muted">{round(ing.calories)} cal</span>
                    <button
                      type="button"
                      className="icon-button small"
                      onClick={() => removeIngredient(ing.key)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="muted small">
            Total: {round(totals.calories)} cal · Per serving: {round(perServing.calories)} cal, P{' '}
            {round(perServing.protein_g)}g · Net C {round(Math.max(0, perServing.carbs_g - perServing.fiber_g))}g
            · F {round(perServing.fat_g)}g
          </p>

          <h3>Add from your foods</h3>
          {foods.length > 0 && (
            <input placeholder="Search your foods…" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
          {foods.length === 0 && (
            <p className="muted small">
              No saved foods yet — add some under Foods first, then build recipes from them.
            </p>
          )}
          {foods.length > 0 && filteredFoods.length === 0 && <p className="muted small">No match.</p>}
          <div className="favorites-list">
            {filteredFoods.map((food) => (
              <div key={food.id} className="favorite-row">
                <div className="favorite-info">
                  <span>{food.name}</span>
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
                <button type="button" onClick={() => addIngredient(food)}>
                  Add
                </button>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save recipe'}
          </button>
        </form>
      </div>
    </div>
  )
}
