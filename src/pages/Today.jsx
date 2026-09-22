import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { MEAL_TYPES, MEAL_LABELS, sumTotals, round, dateFromOffset, dayLabel } from '../lib/nutrition'
import MealSection from '../components/MealSection'
import TargetBar from '../components/TargetBar'
import AddEntryModal from '../components/AddEntryModal'

export default function Today() {
  const { user, household } = useAuth()
  const [entries, setEntries] = useState([])
  const [target, setTarget] = useState(null)
  const [householdTotals, setHouseholdTotals] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingMeal, setAddingMeal] = useState(null)
  const [dayOffset, setDayOffset] = useState(0)

  const date = dateFromOffset(dayOffset)

  const load = useCallback(async () => {
    setLoading(true)
    const [entriesRes, targetRes, householdRes] = await Promise.all([
      supabase
        .from('food_entries')
        .select('*')
        .eq('household_id', household.id)
        .eq('user_id', user.id)
        .eq('logged_date', date)
        .order('created_at', { ascending: true }),
      supabase.from('daily_targets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('food_entries')
        .select('user_id, calories')
        .eq('household_id', household.id)
        .eq('logged_date', date),
    ])

    setEntries(entriesRes.data || [])
    setTarget(targetRes.data)

    const byUser = {}
    for (const row of householdRes.data || []) {
      byUser[row.user_id] = (byUser[row.user_id] || 0) + Number(row.calories || 0)
    }
    setHouseholdTotals(Object.entries(byUser).map(([userId, calories]) => ({ userId, calories })))

    setLoading(false)
  }, [household.id, user.id, date])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="muted">Loading…</p>

  const totals = sumTotals(entries)

  return (
    <div className="page">
      <div className="day-nav">
        <button className="icon-button" onClick={() => setDayOffset((o) => o - 1)} aria-label="Previous day">
          ‹
        </button>
        <h1>{dayLabel(dayOffset, date)}</h1>
        <button className="icon-button" onClick={() => setDayOffset((o) => o + 1)} aria-label="Next day">
          ›
        </button>
        {dayOffset !== 0 && (
          <button className="link-button day-nav-today" onClick={() => setDayOffset(0)}>
            Today
          </button>
        )}
      </div>

      <TargetBar totals={totals} target={target} />

      {householdTotals.length > 1 && (
        <div className="household-strip">
          {householdTotals.map((h) => (
            <span key={h.userId} className={h.userId === user.id ? 'me' : ''}>
              {h.userId === user.id ? 'You' : 'Partner'}: {round(h.calories)} cal
            </span>
          ))}
        </div>
      )}

      {MEAL_TYPES.map((mealType) => (
        <MealSection
          key={mealType}
          label={MEAL_LABELS[mealType]}
          entries={entries.filter((e) => e.meal_type === mealType)}
          onAdd={() => setAddingMeal(mealType)}
          onChanged={load}
        />
      ))}

      {addingMeal && (
        <AddEntryModal
          mealType={addingMeal}
          date={date}
          onClose={() => setAddingMeal(null)}
          onLogged={() => {
            setAddingMeal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
