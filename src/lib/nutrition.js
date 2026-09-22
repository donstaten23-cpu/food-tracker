// Shared helpers for aggregating food_entries rows.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

export function sumTotals(entries) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories || 0),
      protein_g: acc.protein_g + Number(e.protein_g || 0),
      carbs_g: acc.carbs_g + Number(e.carbs_g || 0),
      fat_g: acc.fat_g + Number(e.fat_g || 0),
      fiber_g: acc.fiber_g + Number(e.fiber_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  )
}

// Net carbs = total carbs minus fiber, the number apps like Cronometer show
// against the "carb" target since fiber isn't metabolized the same way.
export function netCarbs(totals) {
  return Math.max(0, Number(totals.carbs_g || 0) - Number(totals.fiber_g || 0))
}

// Local calendar date, `offsetDays` from today (negative = past, positive =
// future) — e.g. dateFromOffset(1) is tomorrow, for planning ahead.
export function dateFromOffset(offsetDays = 0) {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function todayIso() {
  return dateFromOffset(0)
}

// "Today" / "Tomorrow" / "Yesterday" near the current day, otherwise a short
// formatted date (e.g. "Thu, Sep 24").
export function dayLabel(offsetDays, isoDate) {
  if (offsetDays === 0) return 'Today'
  if (offsetDays === 1) return 'Tomorrow'
  if (offsetDays === -1) return 'Yesterday'
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function round(n) {
  return Math.round(Number(n) || 0)
}
