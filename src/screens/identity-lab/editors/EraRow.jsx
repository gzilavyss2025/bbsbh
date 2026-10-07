import { useRef, useState } from 'react'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { saveEraRow, uploadEraArt } from '../saveStores.js'

// One era of one club: its years, its name and period abbreviation, a source
// note, and its mark (#1591). `era` is null for the "add an era" form, which
// has no mark to show until it is saved — the art is attached to a saved era.
//
// Save and Delete go to the server, which owns season-marks.json; the page
// hot-reloads off the landed value, so there is no draft store here, only the
// form's own fields. Drop an SVG onto the mark box, or pick one, and it becomes
// the era's mark. Nothing is fetched from anywhere: you bring the file.
const EMPTY = { from: '', to: '', name: '', abbr: '', source: '' }

function formOf(era) {
  return era ? { from: era.from, to: era.to, name: era.name, abbr: era.abbr ?? '', source: era.source ?? '' } : EMPTY
}

export function EraRow({ teamId, era, bust, onArt }) {
  const [form, setForm] = useState(() => formOf(era))
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const inputRef = useRef(null)

  const set = (field) => (e) => setForm((was) => ({ ...was, [field]: e.target.value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(era))

  async function run(task) {
    setMessage(null)
    setBusy(true)
    try {
      const result = await task()
      if (result.error) setMessage({ kind: 'error', text: result.error })
      else return result
    } finally {
      setBusy(false)
    }
    return null
  }

  async function save() {
    const abbr = form.abbr.toUpperCase() // caps-js-exempt: normalises stored data, not a label
    const result = await run(() =>
      saveEraRow({
        action: 'save',
        teamId,
        replaceFrom: era?.from ?? null,
        era: { from: Number(form.from), to: Number(form.to), name: form.name, abbr, source: form.source },
      }),
    )
    if (result) {
      setMessage({ kind: 'ok', text: 'saved' })
      if (!era) setForm(EMPTY)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the ${era.from}-${era.to} era${era.file ? ' and its art' : ''}?`)) return
    await run(() => saveEraRow({ action: 'delete', teamId, from: era.from }))
  }

  async function attach(file) {
    if (!file || !era) return
    const result = await run(async () =>
      uploadEraArt({ teamId, from: era.from, svg: await file.text() }),
    )
    if (inputRef.current) inputRef.current.value = ''
    if (result) {
      onArt?.()
      setMessage({ kind: 'ok', text: `saved to ${result.file}` })
    }
  }

  return (
    <Card as="li" frame="ledger" body="flush" className={era ? 'idlab__era' : 'idlab__era idlab__era--new'}>
      {era && (
        <div
          className={`idlab__eraart${dragging ? ' idlab__eraart--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            attach(e.dataTransfer?.files?.[0])
          }}
          title="Drop an SVG here"
        >
          {era.file ? (
            <img src={`/logos/historical/${era.file}?v=${bust}`} alt={`${era.name} mark, ${era.from}-${era.to}`} />
          ) : (
            <span className="idlab__eraabbr">{era.abbr}</span>
          )}
        </div>
      )}
      <div className="idlab__erafields">
        <label>
          First season
          <input type="number" inputMode="numeric" value={form.from} onChange={set('from')} />
        </label>
        <label>
          Last season
          <input type="number" inputMode="numeric" value={form.to} onChange={set('to')} />
        </label>
        <label>
          Name
          <input type="text" value={form.name} onChange={set('name')} maxLength={80} />
        </label>
        <label>
          Abbreviation
          <input type="text" value={form.abbr} onChange={set('abbr')} maxLength={4} />
        </label>
        <label className="idlab__erawide">
          Source and licence
          <input type="text" value={form.source} onChange={set('source')} maxLength={300} />
        </label>
      </div>
      <div className="idlab__eraactions">
        <button type="button" className="colorlab__wparesetbtn" onClick={save} disabled={busy || !dirty}>
          {era ? 'Save era' : 'Add era'}
        </button>
        {era && (
          <>
            <input
              ref={inputRef}
              className="colorlab__logodropinput"
              type="file"
              accept="image/svg+xml,.svg"
              aria-label={`Upload an SVG for ${era.name} ${era.from}-${era.to}`}
              onChange={(e) => attach(e.target.files?.[0])}
            />
            <button type="button" className="colorlab__wparesetbtn" onClick={() => inputRef.current?.click()} disabled={busy}>
              {era.file ? 'Replace SVG' : 'Add SVG'}
            </button>
            <button type="button" className="colorlab__wparesetbtn" onClick={remove} disabled={busy}>
              Delete
            </button>
          </>
        )}
      </div>
      {message && <p className={`colorlab__logodropmsg colorlab__logodropmsg--${message.kind}`}>{message.text}</p>}
    </Card>
  )
}
