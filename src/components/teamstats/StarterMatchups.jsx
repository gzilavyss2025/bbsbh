import { useCallback, useState } from 'react'
import { matchupLine } from '../../api/careerMatchups.js'

// How each batter has done in his career against the starter he's about to
// face, rendered as a margin note under his name in the batting order rather
// than as a card of its own — the thing a paper scorer pencils beside the name
// while staging the sheet.
//
// This replaced a standalone "Career vs today's starter" card. The card was
// removed rather than kept alongside because the two lists are the same fact
// twice: the notes ARE the card, attached to the names they describe. What the
// card had that a note doesn't is a heading saying what the numbers mean, which
// is what MatchupNotesToggle puts back — see its own comment.
//
// Everything here renders OUTSIDE any seal, on the same footing as the batting
// order it annotates: career totals against one pitcher carry no part of
// tonight's score. Spoiler-safe by construction, not by clamp.

// Whether the notes are shown, persisted across visits like
// useKeepAwakePreference (same shape, same degradation). Lives here rather than
// in src/hooks/ only because that directory sits at its check-dir-size budget;
// it is an ordinary preference hook otherwise.
//
// Default ON, unlike keepAwake's opt-in default: the notes are the surface's
// content, not an extra cost like holding a wake lock, so a first-time visitor
// must see them. Off is the deliberate choice — a clean order to copy onto
// paper — which is why only an explicit '0' turns them off.
const NOTES_KEY = 'bbsbh:matchupNotes'

function readStoredNotes() {
  try {
    return window.localStorage.getItem(NOTES_KEY) !== '0'
  } catch {
    return true
  }
}

export function useMatchupNotes() {
  const [showNotes, setStored] = useState(readStoredNotes)

  const setShowNotes = useCallback((value) => {
    setStored(value)
    try {
      window.localStorage.setItem(NOTES_KEY, value ? '1' : '0')
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [])

  return { showNotes, setShowNotes }
}

// The control that both LABELS and switches the notes, sitting in the batting
// order masthead's aside slot (the same slot BullpenBoard puts an InfoPopover
// in). It carries the pitcher's surname because a bare "3-for-5, 1 K" under a
// name is genuinely ambiguous — it could read as a season line or a last-game
// line — and the notes' own rows deliberately don't repeat "vs May" nine times.
//
// Colour is not free here: kraft gold as TEXT on the bar measures 4.35:1,
// under the 4.5:1 check-contrast.mjs requires, so neither state paints gold
// text. Both states are filled pills (paper when off, kraft when on) rather
// than filled-vs-outline, because the bar is club-themed — a transparent pill
// would sit on 30 different backdrops. The dot is a redundant, non-colour
// state cue: hollow when off, filled when on. See .matchupswitch in
// styles/10-lineup.css for the measured numbers before changing any of it.
//
// No .toUpperCase() anywhere — the caps are CSS, per the ALL-CAPS invariant
// (ADR-0017 / check-name-casing.mjs).
export function MatchupNotesToggle({ pitcherLast, showNotes, onToggle }) {
  if (!pitcherLast) return null
  return (
    <button
      type="button"
      className="matchupswitch"
      aria-pressed={showNotes}
      onClick={() => onToggle(!showNotes)}
    >
      <span className="matchupswitch__dot" aria-hidden="true" />
      vs {pitcherLast}
    </button>
  )
}

// One batter's line, as a second line inside the name cell.
//
// .lineup__namewrap is a wrapping flex container, so without an explicit
// flex-basis:100% (see .lineup__vs in styles/10-lineup.css) this span becomes
// just another flex item: it rides up beside short names and drops below long
// ones, and the card's left edge goes ragged row by row. The full-width basis
// is what makes it a line rather than a trailing fragment.
export function MatchupNote({ row, levelLabel, className = 'lineup__vs' }) {
  if (!row) return null
  return <span className={className}>{matchupLine(row, levelLabel)}</span>
}

// Batters with history against tonight's starter who aren't in the posted nine
// — see splitMatchupRows for why this is never empty in practice. Rendered as
// the list's last row so a pinch-hit read is still on the card.
export function BenchMatchups({ rows, levelLabel, pitcherLast }) {
  if (!rows || rows.length === 0) return null
  return (
    <li className="lineup__bench">
      <span className="lineup__benchlabel">Off the bench vs {pitcherLast}</span>
      {rows.map((r, i) => (
        <span key={r.id}>
          {i > 0 && ' · '}
          <b>{r.name}</b> {matchupLine(r, levelLabel)}
        </span>
      ))}
    </li>
  )
}
