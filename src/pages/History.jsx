import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { round, netCarbs } from '../lib/nutrition'

const RANGE_DAYS = 14

function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function History() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [target, setTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const from = daysAgoIso(RANGE_DAYS - 1)
    setLoading(true)
    Promise.all([
      supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_date', from)
        .order('logged_date', { ascending: true }),
      supabase.from('daily_targets').select('*').eq('user_id', user.id).maybeSingle(),
    ]).then(([entriesRes, targetRes]) => {
      setRows(entriesRes.data || [])
      setTarget(targetRes.data)
      setLoading(false)
    })
  }, [user.id])

  const byDay = useMemo(() => {
    const map = new Map()
    for (let i = RANGE_DAYS - 1; i >= 0; i--) {
      const date = daysAgoIso(i)
      map.set(date, { date, calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, fat_g: 0, entries: [] })
    }
    for (const row of rows) {
      const day = map.get(row.logged_date)
      if (!day) continue
      day.calories += Number(row.calories || 0)
      day.protein_g += Number(row.protein_g || 0)
      day.carbs_g += Number(row.carbs_g || 0)
      day.fiber_g += Number(row.fiber_g || 0)
      day.fat_g += Number(row.fat_g || 0)
      day.entries.push(row)
    }
    return Array.from(map.values())
  }, [rows])

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <h1>History</h1>
      <p className="muted">Last {RANGE_DAYS} days</p>

      <div className="chart-card">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(5)}
              stroke="var(--text-3)"
              fontSize={12}
            />
            <YAxis stroke="var(--text-3)" fontSize={12} width={36} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-1)' }}
              formatter={(v) => [`${round(v)} cal`, 'Calories']}
            />
            {target && <ReferenceLine y={target.calories} stroke="var(--accent)" strokeDasharray="4 4" />}
            <Bar dataKey="calories" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="day-list">
        {byDay
          .slice()
          .reverse()
          .map((day) => (
            <li key={day.date}>
              <button className="day-row" onClick={() => setExpanded(expanded === day.date ? null : day.date)}>
                <span>{day.date}</span>
                <span className="muted">
                  {round(day.calories)} cal · P {round(day.protein_g)}g · Net C {round(netCarbs(day))}g · F{' '}
                  {round(day.fat_g)}g
                </span>
              </button>
              {expanded === day.date && (
                <ul className="entry-list nested">
                  {day.entries.length === 0 && <li className="muted small">Nothing logged.</li>}
                  {day.entries.map((e) => (
                    <li key={e.id}>
                      <span>
                        [{e.meal_type}] {e.quantity} {e.unit} {e.description}
                      </span>
                      <span className="muted">{round(e.calories)} cal</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}
