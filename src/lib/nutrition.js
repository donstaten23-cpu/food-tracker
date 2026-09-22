// Shared helpers for aggregating food_entries rows.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']

export function sumMacros(items) {
  return items.reduce((acc, item) => {
    for (const key of MACRO_KEYS) acc[key] += Number(item[key] || 0)
    return acc
  }, Object.fromEntries(MACRO_KEYS.map((k) => [k, 0])))
}

export function sumTotals(entries) {
  return sumMacros(entries)
}

// Scales a per-serving macro object (a food, or a recipe's per-serving
// totals) by a ratio — e.g. quantity logged / serving_qty.
export function scaleMacros(macros, ratio) {
  return Object.fromEntries(MACRO_KEYS.map((k) => [k, Number(macros[k] || 0) * ratio]))
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
