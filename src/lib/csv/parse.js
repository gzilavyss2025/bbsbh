// A minimal CSV reader, shared by the nightly Savant generators (via
// scripts/lib/savant.mjs) and the app's Matchup Scout head-to-head. No npm
// dependency. Pure.
//
// parseCsv: a minimal row parser — handles quoted fields with embedded commas
// (e.g. "Whitlock, Garrett") and doubled-quote escaping. No npm dependency,
// matching the rest of scripts/'s self-contained convention.
export function parseCsv(text) {
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
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// Rows -> array of objects keyed by header name, with the BOM and stray header
// whitespace stripped. Savant's first column is literally named
// "last_name, first_name" — quoted, with the comma inside — which is why the
// parser above has to handle quoting at all.
export function csvObjects(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const [header, ...data] = rows
  const names = header.map((n) => n.trim())
  return data.map((r) => {
    const o = {}
    names.forEach((n, i) => { o[n] = r[i] })
    return o
  })
}
