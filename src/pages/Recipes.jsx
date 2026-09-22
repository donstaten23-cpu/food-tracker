import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import RecipeRow from '../components/RecipeRow'
import RecipeBuilder from '../components/RecipeBuilder'

export default function Recipes() {
  const { household } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [building, setBuilding] = useState(false) // false | true (new) | recipe object (editing)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('household_id', household.id)
      .order('name', { ascending: true })
    if (error) setLoadError(error.message)
    else setRecipes(data || [])
    setLoading(false)
  }, [household.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <h1>Recipes</h1>
      <p className="muted">
        Combine foods you've already saved into one reusable item — logs as a single entry, scaled to how
        many servings you ate.
      </p>

      {loadError && <p className="error">{loadError}</p>}

      <button type="button" onClick={() => setBuilding(true)}>
        + New recipe
      </button>

      {recipes.length === 0 && !loadError && <p className="muted">No recipes yet.</p>}

      <ul className="food-list">
        {recipes.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} onEdit={() => setBuilding(recipe)} onChanged={load} />
        ))}
      </ul>

      {building && (
        <RecipeBuilder
          recipe={building === true ? null : building}
          onClose={() => setBuilding(false)}
          onSaved={() => {
            setBuilding(false)
            load()
          }}
        />
      )}
    </div>
  )
}
