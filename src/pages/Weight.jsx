import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayIso } from '../lib/nutrition'

const RANGE_DAYS = 90

export default function Weight() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayIso())
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - RANGE_DAYS)
    const { data, error: loadErr } = await supabase
      .from('body_weights')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', from.toISOString().slice(0, 10))
      .order('logged_date', { ascending: true })
    if (loadErr) setError(loadErr.message)
    else setRows(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const first = rows[0]
    const latest = rows[rows.length - 1]
    return { first, latest, change: Number(latest.weight_lb) - Number(first.weight_lb) }
  }, [rows])

  async function handleSave(e) {
    e.preventDefault()
    const lb = Number(weight)
    if (!(lb > 0)) return setError('Enter a weight greater than 0.')

    setSaving(true)
    setError('')
    const { error: saveErr } = await supabase
      .from('body_weights')
      .upsert({ user_id: user.id, logged_date: date, weight_lb: lb }, { onConflict: 'user_id,logged_date' })
    setSaving(false)
    if (saveErr) return setError(saveErr.message)
    setWeight('')
    load()
  }

  async function handleDelete(id) {
    await supabase.from('body_weights').delete().eq('id', id)
    load()
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <h1>Weight</h1>
      <p className="muted">Last {RANGE_DAYS} days</p>

      <section className="settings-section">
        <form onSubmit={handleSave} className="settings-form">
          <div className="field-row">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} required />
            </label>
            <label>
              Weight (lb)
              <input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} required />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Log weight'}
          </button>
        </form>
      </section>

      {stats && (
        <p className="muted">
          Latest: <strong>{stats.latest.weight_lb} lb</strong> on {stats.latest.logged_date}
          {rows.length > 1 && (
            <>
              {' · '}
              {stats.change > 0 ? '+' : ''}
              {stats.change.toFixed(1)} lb since {stats.first.logged_date}
            </>
          )}
        </p>
      )}

      {rows.length === 0 && !error && <p className="muted">No weigh-ins logged yet.</p>}

      {rows.length > 1 && (
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="logged_date" tickFormatter={(d) => d.slice(5)} stroke="var(--text-3)" fontSize={12} />
              <YAxis stroke="var(--text-3)" fontSize={12} width={40} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-1)' }}
                formatter={(v) => [`${v} lb`, 'Weight']}
              />
              <Line type="monotone" dataKey="weight_lb" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="day-list">
          {rows
            .slice()
            .reverse()
            .map((row) => (
              <li key={row.id} className="day-row">
                <span>{row.logged_date}</span>
                <span className="entry-right">
                  <span className="muted">{row.weight_lb} lb</span>
                  <button type="button" className="icon-button small" onClick={() => handleDelete(row.id)} aria-label="Delete">
                    ×
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
