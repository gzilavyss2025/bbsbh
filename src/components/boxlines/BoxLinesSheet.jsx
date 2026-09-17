import '../../styles/boxlines/boxlines.css'
import '../../styles/boxlines/listdoor.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchBoxLines } from '../../api/boxlines/fetch.js'
import { foldGroups, foldStats, LIST_COLUMNS } from '../../api/boxlines/fold.js'
import { useAsync } from '../../hooks/useAsync.js'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { BoxLineRow, BoxLineSkeleton } from './BoxLineRow.jsx'
import { BoxLinesList } from './BoxLinesList.jsx'
import { Stat } from '../gamehud/StatBox.jsx'
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
// THE HEADLINE is the tapped line, verbatim, so the door and the sheet can
// never disagree. It is the career aggregate already open on the page
// (ADR-0034); it may say a meeting happened, never how it went.
//
// AND ONE DOOR OPENS A LIST (#1048). A question with too many answers to be
// doors — the nine spots in the batting order, #998's thirty-six ballparks —
// hands this sheet a `list` descriptor instead of a facet. The sheet then opens
// on the GROUPS, folded from the same gated rows (api/boxlines/fold.js), and a
// tap re-renders it in rows mode for that group. The join is memoized per
// (person, group, cutoff, gameTypes), so going in and back out again costs no
// requests at all — both questions read the rows the first one already
// fetched.
//
// A LIST CHANGES NOTHING ABOUT THE GATE. It folds rows that already passed it:
// the cutoff still runs first and a facet's `keep` still runs last, so a list
// can only ever describe games the gate allowed. On a page carrying `?d=` a
// folded line therefore stops where the rows stop — which is more correct than
// a career aggregate would be, and it is what makes an entry and its rows agree
// by construction.
export function BoxLinesSheet({
  personId,
  playerSurname,
  group,
  opponentId,
  opponentName,
  facet = null,
  list = null,
  kicker = 'Game lines · regular season',
  title,
  footNote = null,
  headline,
  cutoff = null,
  onClose,
}) {
  // WHICH GROUP OF A LIST the reader has picked, or null while the list itself
  // is showing. A sheet with no `list` is never in list mode and this stays
  // null for its whole life.
  const [picked, setPicked] = useState(null)
  const listing = Boolean(list) && !picked
  // A caller that named only an opponent is asking the club question; one that
  // named a facet is asking its own; one that named a LIST asks the list's own
  // question first — every row that has a group — and then the picked group's.
  // Serialised for the dependency list because an object literal is a new
  // identity on every render, and useAsync would refetch each one.
  const question = picked
    ? picked.facet
    : list
      ? list.facet(null)
      : (facet ?? (opponentId ? { kind: 'club', opponentId } : null))
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
  // The groups, folded from the rows the gate approved. A group with no rows
  // cannot exist, because the groups are built FROM the rows: a hitter who has
  // never batted ninth gets eight entries, not a ninth reading zero.
  const groups = useMemo(
    () => (listing && rows ? foldGroups(rows, list, group) : null),
    [listing, rows, list, group],
  )
  // Once a group is picked the sheet says which one, in all three places a
  // reader reads: the kicker, the heading and the headline — which is the
  // entry's own line, verbatim, the same contract a door's headline keeps.
  const heading = picked
    ? list.title(playerSurname, picked.name)
    : (title ?? `${playerSurname} vs the ${opponentName}`)
  const kick = picked ? `Game lines · ${picked.name}` : kicker
  // A PICKED GROUP GETS THE WHOLE LINE, not the entry's two figures. The entry
  // is one row of a comparison and says what a column has room for; this is
  // where the reader came FOR the detail, so it folds the same rows into the
  // box-score vocabulary — counts, then the slash line or the rates
  // (api/boxlines/fold.js). It is the same fold the entry printed, so the two
  // cannot disagree.
  const stats = useMemo(
    () => (picked && rows?.length ? foldStats(rows, group) : null),
    [picked, rows, group],
  )
  const head = picked || listing ? null : headline

  // Back to the list, with the focus kept inside the dialog: the control the
  // reader pressed is the one that unmounts, and focus would otherwise fall to
  // the document.
  const toList = () => {
    setPicked(null)
    closeRef.current?.focus()
  }

  return (
    <ModalPortal>
      <div
        className="scrim scrim--boxlines"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <div className="sheet boxlines" role="dialog" aria-modal="true" aria-label={heading}>
          <div className="boxlines__head">
            <div>
              {picked && (
                <button type="button" className="boxlines__back" onClick={toList}>
                  ‹ Back
                </button>
              )}
              <p className="boxlines__kicker">{kick}</p>
              <h2 className="sheet__title boxlines__title">{heading}</h2>
            </div>
            <button ref={closeRef} type="button" className="sheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {head && <p className="boxlines__headline">{head}</p>}
          {stats && (
            <div className="boxlines__stats">
              {stats.map((c) => (
                /* The app's own stat cell, the one the player page's grid above
                   this sheet is built from — a figure over its name. A null is
                   a rate with no denominator and draws the quiet mark, never a
                   zero. */
                <Stat key={c.k} k={c.k} v={c.v ?? '·'} tone={c.v == null ? 'nil' : undefined} />
              ))}
            </div>
          )}

          {/* The row skeletons stand in for a loading LIST too: the sheet is
              one fetch either way, and a second skeleton shape would be a
              second thing to keep in step with the rows it precedes. */}
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

          {/* THE GROUPS, not the rows. Tapping one asks the same join its own
              question, which it has already answered — so the switch costs no
              request. */}
          {listing && groups?.length > 0 && (
            <BoxLinesList
              groups={groups}
              columns={LIST_COLUMNS[group] ?? LIST_COLUMNS.hitting}
              onPick={setPicked}
            />
          )}

          {!listing && rows && rows.length > 0 && (
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
                {/* A facet says its own word first, when it has one — the
                    postseason door names the round its pill abbreviates. */}
                {footNote ? `${footNote} ` : ''}Newest first. The mark is the club he{' '}
                {group === 'pitching' ? 'pitched' : 'played'} for that day; his club’s runs come first.
                Tap a game for its box score.
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
