// Minimal CSV parser for the checked-in contract seed data
// (scripts/data/contracts/*.csv). Handles double-quoted fields containing
// commas (every player name is "Last, First") and doubled-quote escapes
// ("" -> "). No dependency added -- the repo's package.json is deliberately
// minimal and these files are simple, well-formed exports with no embedded
// newlines inside a field.

export function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

// Parses a full CSV document (header row + data rows) into an array of plain
// objects keyed by the header. Empty cells become ''.
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    header.forEach((key, i) => {
      row[key] = cells[i] ?? ''
    })
    return row
  })
}
