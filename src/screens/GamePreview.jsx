import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPreviewModel } from '../api/gamePreview.js'
import { selectOfficials } from '../api/select.js'
import { loadUmpire } from '../api/umpires.js'
import { useAsync } from '../hooks/useAsync.js'
import { useCopy } from '../copy/copyContext.js'
import { drawPoster } from '../lib/preview/drawPoster.js'
import { loadPosterArt } from '../lib/preview/posterArt.js'
import { cardsHeight, POSTER, posterLayout } from '../lib/preview/posterLayout.js'
import { ensurePosterFonts } from '../lib/preview/posterPaper.js'
import { SavePosterButton } from '../components/preview/SavePosterButton.jsx'
import '../styles/62-game-preview.css'

// The preview poster's studio: the sheet on the left (or on top, on a phone),
// the controls beside it, and one button that turns the canvas into a PNG.
//
// WHY A CANVAS AND NOT A DIV. The deliverable is an image file, so the page has
// to be able to rasterise what it shows. The two ways to rasterise HTML both
// fail here: a third-party DOM-to-canvas library is a dependency this project
// doesn't take, and hand-rolling <foreignObject> means inlining every rule and
// all four woff2 faces into a serialised SVG — brittle, and worst on iOS
// Safari, which is the phone this app is built for. Painting the poster
// directly means the thing on screen IS the thing that gets saved, pixel for
// pixel, with nothing to keep in sync. The composition lives in
// lib/preview/poster*.js; this screen only owns the controls.
//
// Nothing here can print a score: the canvas is handed buildPreviewModel's
// object and nothing else — no feed, no linescore, no gamePk. See
// api/gamePreview.js for why that boundary is where the spoiler audit happens.

// Each block, and the question that decides whether there is anything to put
// in it. A block with no data is switched OFF rather than printed as a tall
// panel saying "not posted yet": the poster is a thing you post, and a third of
// it reading NOT POSTED YET is not a poster anybody sends. The control stays
// visible but disabled, so the page still says the section exists and why it
// can't be used yet — the lineups for tomorrow's game genuinely aren't out.
const BLOCKS = [
  {
    key: 'arms',
    label: 'Starting pitchers',
    has: (m) => Boolean(m.starters.away || m.starters.home),
    waitingFor: 'Neither starter announced',
  },
  {
    key: 'cards',
    label: 'Batting order',
    has: (m) => m.lineups.away.length > 0 || m.lineups.home.length > 0,
    waitingFor: 'Lineups post close to first pitch',
  },
  {
    key: 'zone',
    label: 'Behind the plate',
    has: (m) => Boolean(m.plate),
    waitingFor: 'Umpire crew not assigned yet',
  },
]

export function GamePreview({ feed, starterLines, broadcast, treatments }) {
  const { t } = useCopy()
  const canvasRef = useRef(null)
  const [on, setOn] = useState({ arms: true, cards: true, zone: true })

  // The plate umpire's season card. Fetched here rather than threaded through
  // useGameData: this is the only surface that wants it for a game, and
  // loadUmpire reads static nightly files, so it costs one cached read.
  const plateId = useMemo(() => selectOfficials(feed).find((o) => o.role === 'HP')?.id ?? null, [feed])
  const umpire = useAsync(() => (plateId ? loadUmpire(plateId) : Promise.resolve(null)), [plateId])

  const model = useMemo(
    () => buildPreviewModel(feed, { starterLines, broadcast, umpire: umpire.data }),
    [feed, starterLines, broadcast, umpire.data],
  )

  // Art and fonts both have to be in hand BEFORE the first paint — a canvas
  // bakes in whatever was loaded at fillText/drawImage time and never reflows
  // when the rest arrives. `ready` is what re-paints once they land.
  const art = useAsync(
    () => (model ? loadPosterArt(model, treatments, t).then(async (a) => {
      await ensurePosterFonts()
      return a
    }) : Promise.resolve(null)),
    [model, treatments],
  )

  // What the user asked for, intersected with what actually exists. Kept as an
  // intersection rather than by writing back into `on`, so a section the user
  // switched off stays off when its data lands, and one they left on comes back
  // by itself the moment the lineup posts.
  const available = useMemo(
    () => new Set(model ? BLOCKS.filter((b) => b.has(model)).map((b) => b.key) : []),
    [model],
  )
  const enabled = useMemo(
    () => new Set(BLOCKS.filter((b) => on[b.key] && available.has(b.key)).map((b) => b.key)),
    [on, available],
  )
  const heights = useMemo(
    () =>
      model
        ? { cards: cardsHeight(Math.max(model.lineups.away.length, model.lineups.home.length)) }
        : {},
    [model],
  )
  const overflows = posterLayout(enabled, heights).overflows

  useEffect(() => {
    if (!model || !art.data) return
    drawPoster(canvasRef.current, model, art.data, { enabled, heights })
  }, [model, art.data, enabled, heights])

  if (!model) return null

  const filename = `${model.away.abbr || 'away'}-${model.home.abbr || 'home'}-${model.officialDate}.png`
  const painted = Boolean(art.data)

  return (
    <div className="posterstudio">
      <div className="posterstudio__sheet">
        {/* Fixed 1200×1600 backing store, scaled DOWN by CSS to fit the page —
            the export's pixel size is part of the deliverable, not a function
            of the screen it was painted on. */}
        <canvas
          ref={canvasRef}
          className="posterstudio__canvas"
          width={POSTER.width}
          height={POSTER.height}
          role="img"
          aria-label={`Preview poster: ${model.away.place} ${model.away.nick} at ${model.home.place} ${model.home.nick}, ${model.date.monthDay}`}
        />
        {!painted && <p className="posterstudio__loading">Setting the poster…</p>}
      </div>

      <div className="posterstudio__panel">
        <h2 className="posterstudio__title">Preview card</h2>
        <p className="posterstudio__note">
          A 1200 × 1600 image, the tallest an X timeline shows without cropping it.
        </p>

        <fieldset className="posterstudio__blocks">
          <legend className="posterstudio__legend">What goes on it</legend>
          {BLOCKS.map((b) => {
            const ready = available.has(b.key)
            return (
              <label
                key={b.key}
                className={`posterstudio__check ${ready ? '' : 'posterstudio__check--waiting'}`}
              >
                <input
                  type="checkbox"
                  checked={on[b.key] && ready}
                  disabled={!ready}
                  onChange={() => setOn((prev) => ({ ...prev, [b.key]: !prev[b.key] }))}
                />
                <span>{b.label}</span>
                {!ready && <em className="posterstudio__waiting">{b.waitingFor}</em>}
              </label>
            )
          })}
        </fieldset>

        {overflows && (
          <p className="posterstudio__warn">
            Turn one section off — three full sections run past the bottom of the sheet.
          </p>
        )}

        <SavePosterButton
          canvasRef={canvasRef}
          filename={filename}
          title={`${model.away.abbr} at ${model.home.abbr}`}
          disabled={!painted}
        />
        <p className="posterstudio__hint">
          On a phone this opens the share sheet, where Save Image puts it in Photos. On a
          computer it downloads.
        </p>
      </div>
    </div>
  )
}

export default GamePreview
