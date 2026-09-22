import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { parseCsv, foodsFromRows } from '../lib/csv'
import { round } from '../lib/nutrition'

const CHUNK_SIZE = 200

// Same food = same name + brand, ignoring case.
const foodKey = (f) => `${f.name.trim().toLowerCase()}|${(f.brand || '').trim().toLowerCase()}`

export default function ImportFoods() {
  const { user, household } = useAuth()
  const [preview, setPreview] = useState(null) // { fresh, duplicates, errors }
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [inputKey, setInputKey] = useState(0) // bumping this resets the file input

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('')
    setPreview(null)
    setBusy(true)

    try {
      const { foods, errors } = foodsFromRows(parseCsv(await file.text()))

      // Skip anything already in the household's catalog, and repeats within
      // the file itself, so re-importing an edited file doesn't double up.
      const { data: existing, error } = await supabase
        .from('foods')
        .select('name, brand')
        .eq('household_id', household.id)
      if (error) throw error

      const seen = new Set((existing || []).map(foodKey))
      const fresh = []
      const duplicates = []
      for (const food of foods) {
        const key = foodKey(food)
        if (seen.has(key)) {
          duplicates.push(food)
        } else {
          seen.add(key)
          fresh.push(food)
        }
      }
      setPreview({ fresh, duplicates, errors })
    } catch (err) {
      setMessage(`Couldn't read that file: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!preview?.fresh.length) return
    setBusy(true)
    setMessage('')

    // Imported presets are stamped as "used long ago" so they don't crowd
    // out what you've actually eaten recently at the top of Quick add.
    const rows = preview.fresh.map((f) => ({
      ...f,
      household_id: household.id,
      created_by: user.id,
      source: 'exact',
      last_used_at: '2000-01-01T00:00:00Z',
    }))

    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const { error } = await supabase.from('foods').insert(rows.slice(i, i + CHUNK_SIZE))
        if (error) throw error
      }
      setMessage(`Imported ${rows.length} food${rows.length === 1 ? '' : 's'}. They're in Quick add now.`)
      setPreview(null)
      setInputKey((k) => k + 1)
    } catch (err) {
      setMessage(`Import failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-section">
      <h2>Import foods from CSV</h2>
      <p className="muted">
        Add lots of presets at once. Each row becomes a food in Quick add — a single meal you
        eat regularly can be one row with its totals.
      </p>
      <p className="muted small">
        Columns: <strong>name</strong> and <strong>calories</strong> are required; optional:
        brand, quantity, unit, protein_g, carbs_g, fat_g.{' '}
        <a href={`${import.meta.env.BASE_URL}food-import-template.csv`} download>
          Download a template
        </a>{' '}
        (the numbers in it are just examples).
      </p>

      <input key={inputKey} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} />

      {preview && (
        <div className="import-preview">
          <p>
            <strong>{preview.fresh.length}</strong> ready to import
            {preview.duplicates.length > 0 && (
              <>
                {' · '}
                <span className="muted">{preview.duplicates.length} already in your list (skipped)</span>
              </>
            )}
            {preview.errors.length > 0 && (
              <>
                {' · '}
                <span className="error">{preview.errors.length} with problems (skipped)</span>
              </>
            )}
          </p>

          {preview.fresh.length > 0 && (
            <ul className="import-list">
              {preview.fresh.slice(0, 8).map((f, i) => (
                <li key={i}>
                  <span>
                    {f.name}
                    {f.brand ? <span className="muted small"> ({f.brand})</span> : null}
                  </span>
                  <span className="muted small">
                    {round(f.calories)} cal per {f.serving_qty} {f.serving_unit}
                  </span>
                </li>
              ))}
              {preview.fresh.length > 8 && (
                <li className="muted small">…and {preview.fresh.length - 8} more</li>
              )}
            </ul>
          )}

          {preview.errors.length > 0 && (
            <ul className="import-errors">
              {preview.errors.slice(0, 10).map((err, i) => (
                <li key={i} className="error small">
                  {err.line > 0 ? `Row ${err.line}: ` : ''}
                  {err.message}
                </li>
              ))}
              {preview.errors.length > 10 && (
                <li className="muted small">…and {preview.errors.length - 10} more</li>
              )}
            </ul>
          )}

          <button onClick={handleImport} disabled={busy || preview.fresh.length === 0}>
            {busy ? 'Importing…' : `Import ${preview.fresh.length} food${preview.fresh.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {message && <p className={message.startsWith('Imported') ? 'muted' : 'error'}>{message}</p>}
    </section>
  )
}
