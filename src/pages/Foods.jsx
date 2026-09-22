import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import FoodRow from '../components/FoodRow'

export default function Foods() {
  const { household } = useAuth()
  const [foods, setFoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('household_id', household.id)
      .order('name', { ascending: true })
      .limit(1000)
    if (error) setLoadError(error.message)
    else setFoods(data || [])
    setLoading(false)
  }, [household.id])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return foods
    return foods.filter((f) => f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q))
  }, [foods, search])

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <h1>Saved foods</h1>
      <p className="muted">
        Everything in your Quick add list, shared with your household. Edit the numbers or remove what you
        don't eat anymore.
      </p>

      {loadError && <p className="error">{loadError}</p>}

      {foods.length > 0 && (
        <input placeholder={`Search ${foods.length} foods…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      )}

      {foods.length === 0 && !loadError && (
        <p className="muted">
          No saved foods yet. Add one from "New food" when you log a meal, or import a CSV in Settings.
        </p>
      )}
      {foods.length > 0 && filtered.length === 0 && <p className="muted">No foods match "{search}".</p>}

      <ul className="food-list">
        {filtered.map((food) => (
          <FoodRow key={food.id} food={food} allFoods={foods} onChanged={load} />
        ))}
      </ul>
    </div>
  )
}
