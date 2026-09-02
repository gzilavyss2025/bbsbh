import '../../styles/boxlines/boxlines.css'
import { useEffect, useRef } from 'react'
import { fetchBoxLines } from '../../api/boxlines/fetch.js'
import { useAsync } from '../../hooks/useAsync.js'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { BoxLineRow, BoxLineSkeleton } from './BoxLineRow.jsx'
import { humanDateWithYear } from '../../lib/dates.js'

// BOX LINES — the drilldown behind a summary stat line (ADR-0069). Tap a
// line such as "Career vs MIL: 7 G, 34.0 IP, 3.44 ERA, 28 K, 17 BB" and this
// sheet shows the game-by-game rows that add up to it, each linking to that
// game's box score. The name is the thing to use in a prompt: "make the box
// lines open from X, showing Y." One shell for every facet (a club, a park,
// day/night, a hand); v1 is a pitcher vs the club he is about to face, opened
// from the lineup page's Starting pitcher card.
//
// ONE SHELL, ANY FACET. The sheet is handed a `facet` (api/boxlines/facets.js)
// — a club, a park, a month, day or night — and titles itself from `kicker`
// and `title`. Both default to the club case, which is what the two doors
// shipped so far ask for, so a caller that only wants "him against the
// Brewers" still passes opponentId/opponentName and nothing else. "Box Lines"
// is the INTERNAL name for this drilldown and never renders: the kicker says
// "Game lines · {facet}", the vocabulary the body copy under it already uses.
//
// SPOILER FOOTING. This opens from the lineup page, a scoring surface, and
// every row carries a final score. The rule that keeps it honest lives in
// api/boxlines/rows.js (cutoff-gated), not here: rows arrive already trimmed
// to games strictly before `cutoff` and reported Final, and the cutoff season
// was fetched only through the day before. This component holds NO date
// logic — it renders what it is handed, and a row it was not handed does not
// exist in the DOM. `cutoff` is the scored game's officialDate on the lineup
// page, the page's `?d=` elsewhere, or null on an open surface.
//
// THE SHAPE. A sheet dialog, not the wire's rail and dock (ADR-0061/0062):
// those are ambient and non-modal because the slate behind them must stay
// live; a drilldown is tapped, read and dismissed, which is the app's
// `.scrim`/`.sheet` contract — dismiss via backdrop, close button or Escape;
// focus moves in on open and back to the trigger on close (same as
// BallparkModal). Portalled to <body> through ModalPortal so it can open from
// any surface, including a half-inning page whose `.turnscene` would trap a
// fixed child's z-index. Bottom sheet on a phone; from the wide breakpoint
// one scrim modifier (`.scrim--boxlines`) anchors the same sheet to the right
// edge, full height, the way `.scrim--center` centres the highlight player.
//
// ALL-CAPS: ModalPortal renders outside `#root`, so 01-base.css's blanket does
// not reach this sheet; boxlines.css re-states it for `.boxlines *` the way
// focus/reference.css does for the reference sheet.
//
// The headline is the tapped line, verbatim, so the door and the sheet can
// never disagree. It is the career aggregate already open on the page
// (ADR-0034); it may say a meeting happened, never how it went.
export function BoxLinesSheet({
  personId,
  playerSurname,
  group,
  opponentId,
  opponentName,
  facet = null,
  kicker = 'Game lines · regular season',
  title,
  headline,
  cutoff = null,
  onClose,
}) {
  // A caller that named only an opponent is asking the club question; one that
  // named a facet is asking its own. Serialised for the dependency list because
  // an object literal is a new identity on every render, and useAsync would
  // refetch each one.
  const question = facet ?? (opponentId ? { kind: 'club', opponentId } : null)
  const facetKey = JSON.stringify(question)
  const query = useAsync(
    () => fetchBoxLines({ personId, group, cutoff, facet: question }),
    // facetKey IS question, by value — an object literal would be a new
    // identity every render and refetch on each one.
    [personId, group, cutoff, facetKey],
  )

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const rows = query.data
  const failed = !query.loading && rows === null
  const heading = title ?? `${playerSurname} vs the ${opponentName}`

  return (
    <ModalPortal>
      <div
        className="scrim scrim--boxlines"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <div className="sheet boxlines" role="dialog" aria-modal="true" aria-label={heading}>
          <div className="boxlines__head">
            <div>
              <p className="boxlines__kicker">{kicker}</p>
              <h2 className="sheet__title boxlines__title">{heading}</h2>
            </div>
            <button ref={closeRef} type="button" className="sheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {headline && <p className="boxlines__headline">{headline}</p>}

          {query.loading && (
            <>
              <ul className="boxlines__rows" aria-hidden="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <BoxLineSkeleton key={i} />
                ))}
              </ul>
              <p className="hint boxlines__hint">Pulling his game lines…</p>
            </>
          )}

          {failed && (
            <>
              <p className="hint boxlines__hint">Couldn’t pull his game lines. Try again in a moment.</p>
              <button type="button" className="btn boxlines__retry" onClick={query.reload}>
                Try again
              </button>
            </>
          )}

          {rows && rows.length === 0 && (
            <p className="hint boxlines__hint">
              {cutoff ? `No game lines before ${humanDateWithYear(cutoff)}.` : 'No game lines yet.'}
            </p>
          )}

          {rows && rows.length > 0 && (
            <>
              <ul className="boxlines__rows">
                {rows.map((row, i) => (
                  <BoxLineRow
                    key={row.gamePk}
                    row={row}
                    // The year prints once per season group, at its head.
                    showSeason={i === 0 || rows[i - 1].season !== row.season}
                    // Every other season group sits on the brighter paper.
                    band={seasonBand(rows, i)}
                  />
                ))}
              </ul>
              <p className="boxlines__foot">
                Newest first. The mark is the club he {group === 'pitching' ? 'pitched' : 'played'} for that
                day; his club’s runs come first. Tap a game for its box score.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

// Whether row `i` sits on a banded season group: the first season is plain,
// the second banded, and so on, so two games in one year read as one band.
function seasonBand(rows, i) {
  let band = false
  for (let k = 1; k <= i; k++) if (rows[k].season !== rows[k - 1].season) band = !band
  return band
}
