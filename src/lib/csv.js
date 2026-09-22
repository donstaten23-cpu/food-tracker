// Minimal CSV parsing for the preset-foods import. Handles quoted fields
// (commas / newlines / "" escapes inside quotes), CRLF, and a UTF-8 BOM —
// what Excel and Google Sheets exports actually produce.

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully blank lines (trailing newline, spacer rows).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Header names are matched loosely (case, spaces, underscores ignored) so
// "Protein (g)", "protein_g" and "PROTEIN" all work.
const COLUMN_ALIASES = {
  name: ['name', 'food', 'item', 'meal'],
  brand: ['brand'],
  quantity: ['quantity', 'qty', 'servingqty', 'amount'],
  unit: ['unit', 'units', 'servingunit'],
  calories: ['calories', 'cal', 'kcal'],
  protein_g: ['protein', 'proteing'],
  carbs_g: ['carbs', 'carbsg', 'carbohydrates', 'carbohydratesg', 'carbohydrate'],
  fat_g: ['fat', 'fatg', 'fats'],
}

function normalizeHeader(h) {
  // "Calories (kcal)" / "Protein (g)" -> drop the parenthetical unit first.
  return h.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')
}

function toNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN
  return Number(cleaned)
}

// Turns parsed CSV rows (first row = header) into food objects ready to
// insert, plus a list of per-row problems. Rows with problems are skipped.
export function foodsFromRows(rows) {
  if (rows.length === 0) return { foods: [], errors: [{ line: 0, message: 'The file is empty.' }] }

  const header = rows[0].map(normalizeHeader)
  const colIndex = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h))
    if (idx !== -1) colIndex[field] = idx
  }

  if (colIndex.name === undefined || colIndex.calories === undefined) {
    return {
      foods: [],
      errors: [
        {
          line: 1,
          message:
            'The first row must be a header with at least "name" and "calories" columns (optional: brand, quantity, unit, protein_g, carbs_g, fat_g).',
        },
      ],
    }
  }

  const foods = []
  const errors = []

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2 // 1-based, counting the header as line 1
    const get = (field) => (colIndex[field] === undefined ? '' : (cells[colIndex[field]] ?? '').trim())

    const name = get('name')
    if (!name) return void errors.push({ line, message: 'Missing name.' })

    const calories = toNumber(get('calories'))
    if (Number.isNaN(calories)) return void errors.push({ line, message: `"${name}": calories isn't a number.` })

    // Optional numeric columns: blank -> default, garbage -> error.
    const optional = (field, fallback) => {
      const raw = get(field)
      if (raw === '') return fallback
      return toNumber(raw)
    }
    const quantity = optional('quantity', 1)
    const protein_g = optional('protein_g', 0)
    const carbs_g = optional('carbs_g', 0)
    const fat_g = optional('fat_g', 0)

    if ([quantity, protein_g, carbs_g, fat_g].some(Number.isNaN)) {
      return void errors.push({ line, message: `"${name}": a quantity/protein/carbs/fat value isn't a number.` })
    }
    if (quantity <= 0) return void errors.push({ line, message: `"${name}": quantity must be more than 0.` })

    foods.push({
      name,
      brand: get('brand') || null,
      serving_qty: quantity,
      serving_unit: get('unit') || 'serving',
      calories,
      protein_g,
      carbs_g,
      fat_g,
    })
  })

  return { foods, errors }
}
