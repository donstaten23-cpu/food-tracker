import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user, household } = useAuth()
  const [form, setForm] = useState({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('daily_targets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm(data)
        setLoading(false)
      })
  }, [user.id])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await supabase.from('daily_targets').upsert({
      user_id: user.id,
      household_id: household.id,
      calories: Number(form.calories),
      protein_g: Number(form.protein_g),
      carbs_g: Number(form.carbs_g),
      fat_g: Number(form.fat_g),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Daily targets</h2>
        <form onSubmit={handleSave} className="settings-form">
          <label>
            Calories
            <input
              type="number"
              value={form.calories}
              onChange={(e) => setForm({ ...form, calories: e.target.value })}
            />
          </label>
          <label>
            Protein (g)
            <input
              type="number"
              value={form.protein_g}
              onChange={(e) => setForm({ ...form, protein_g: e.target.value })}
            />
          </label>
          <label>
            Carbs (g)
            <input
              type="number"
              value={form.carbs_g}
              onChange={(e) => setForm({ ...form, carbs_g: e.target.value })}
            />
          </label>
          <label>
            Fat (g)
            <input type="number" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save targets'}
          </button>
          {saved && <span className="muted small">Saved.</span>}
        </form>
      </section>

      <section className="settings-section">
        <h2>Household</h2>
        <p className="muted">
          Share this code with your partner so they can join — Settings → they enter it on the
          "Join household" screen.
        </p>
        <code className="invite-code">{household.invite_code}</code>
      </section>
    </div>
  )
}
