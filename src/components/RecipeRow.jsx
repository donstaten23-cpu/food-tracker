import { supabase } from '../lib/supabaseClient'
import { round, scaleMacros, sumMacros, netCarbs } from '../lib/nutrition'

export default function RecipeRow({ recipe, onEdit, onChanged }) {
  const totals = sumMacros(recipe.recipe_ingredients || [])
  const perServing = scaleMacros(totals, 1 / (Number(recipe.servings) || 1))

  async function remove() {
    if (!window.confirm(`Delete "${recipe.name}"? Past log entries keep their numbers.`)) return
    const { error } = await supabase.from('recipes').delete().eq('id', recipe.id)
    if (error) return window.alert(error.message)
    onChanged()
  }

  return (
    <li className="food-row">
      <div className="food-info">
        <span>{recipe.name}</span>
        <span className="muted small">
          {recipe.recipe_ingredients?.length || 0} ingredient
          {(recipe.recipe_ingredients?.length || 0) === 1 ? '' : 's'} · {round(recipe.servings)} serving
          {Number(recipe.servings) === 1 ? '' : 's'} · {round(perServing.calories)} cal/serving · P{' '}
          {round(perServing.protein_g)}g · Net C {round(netCarbs(perServing))}g · F {round(perServing.fat_g)}g
        </span>
      </div>
      <button type="button" className="secondary food-edit-btn" onClick={onEdit}>
        Edit
      </button>
      <button type="button" className="danger" onClick={remove}>
        Delete
      </button>
    </li>
  )
}
