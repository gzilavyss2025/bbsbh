import { useState } from 'react'
import { GameStamp } from '../../../components/logbook/GameStamp.jsx'
import { CopyIconButton } from '../../../components/ui/CopyBox.jsx'
import { contrastRatio } from '../../../lib/contrast.js'
import { STAMP_PAPER, deepenToContrast, isHex } from '../../../lib/stampInk.js'
import { stampInkOverrideFor, stampInkStore } from '../../../lib/stampInkTuning.js'
import { HexField } from '../HexField.jsx'
import { saveStores } from '../saveStores.js'

// Which ink a club's Logbook stamp presses in when it wins — the hand-picked
// override of the automatic pick ADR-0036's addendum computes (the winner's
// darkest brand colour). Exists for the clubs whose automatic answer isn't
// the one they want: the darkest thing a club owns is a defensible default,
// not always the club's own idea of what "its" ink looks like.
//
// The preview is a REAL stamp, same discipline as every other lab editor here
// (MonoInkEditor, StampPlacementEditor): the draft hex is handed to GameStamp
// as its `inkOverride` prop, which the component treats as authoritative over
// the landed store, so what's judged on screen is the actual art. The game
// this preview draws is invented — a fixed date, a made-up ballpark, this
// club as the winner of a 4-3 game — and reaches no schedule, feed, or
// collection, which is what keeps it on
// scripts/check-stamp-surfaces.mjs's allowlist alongside the lab being
// DEV-only and dropped from a production build entirely (App.jsx).
//
// A pick is still walked through `deepenToContrast` before it ever reaches
// the art (src/lib/stampInk.js) — the "as pressed" line below shows what
// actually prints when that differs from what was typed, so a light pick
// doesn't quietly turn into a different colour with no explanation.
//
// WORTH SAYING OUT LOUD, same as the placement editor beside it: a stamp
// keeps game facts and no art, so it is redrawn from these numbers on every
// render. Saving a change here restyles that club's stamps everywhere the
// moment it ships, including keepsakes already minted and placed in other
// people's passport books.

// A stamp needs a game; this one is invented, and its gamePk is a constant so
// the wear filter's turbulence seed doesn't re-chew the ink on every keystroke.
// Distinct from StampPlacementEditor's PREVIEW_GAME so the two editors' stamps
// never collide on <defs> ids if they ever end up on screen together.
const PREVIEW_GAME = { gamePk: 504, date: '2026-08-02', venue: 'Preview Ballpark', innings: 9 }
const OPPONENT = { abbreviation: 'OPP', runs: 3 }

export function StampInkEditor({ teamId, name, abbreviation }) {
  // `edited` stays null until something is actually typed or Reset is
  // clicked, so the landed value is the baseline rather than a copy of it —
  // the same "null means untouched" contract every other editor here keeps,
  // made safe the same way (ClubWorkbench mounts this per club with a `key`).
  const landed = stampInkOverrideFor(teamId)
  const [edited, setEdited] = useState(null)
  const [saveState, setSaveState] = useState(null)

  const rawHex = edited ?? landed ?? ''
  const dirty = edited !== null && edited !== (landed ?? '')
  // What actually prints, or null while the field is empty/mid-edit and not
  // yet a real hex — the automatic pick isn't computed here (GameStamp does
  // that itself when `inkOverride` is blank), so this line only ever
  // describes a DRAFT, never claims to speak for the automatic answer.
  const pressed = isHex(rawHex) ? deepenToContrast(rawHex, STAMP_PAPER) : null
  const contrast = pressed ? contrastRatio(pressed, STAMP_PAPER) : null
  const wasDeepened = pressed !== null && pressed.toUpperCase() !== rawHex.toUpperCase() // caps-js-exempt: hex compare, not display text

  function onField(value) {
    setEdited(value)
    setSaveState(null)
  }

  function reset() {
    setEdited('')
    setSaveState(null)
  }

  async function save() {
    setSaveState({ kind: 'busy', text: 'Saving' })
    const store = structuredClone(stampInkStore())
    const key = String(teamId)
    if (isHex(rawHex)) store[key] = rawHex
    else delete store[key]

    const ok = await saveStores([{ key: 'stamp-ink', body: store }])
    setSaveState(
      ok
        ? { kind: 'ok', text: 'saved — every stamp this club wins redraws from it' }
        : { kind: 'error', text: 'could not write stamp-ink.json — is `npm run dev` running?' },
    )
  }

  const club = { id: teamId, abbreviation, runs: 4 }
  const game = { ...PREVIEW_GAME, away: club, home: OPPONENT, winnerId: teamId }

  return (
    <section className="idlab__stampink" aria-label="Stamp ink">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Stamp ink</span>
        <span className="idlab__monoinkhint">
          {rawHex ? 'Custom' : 'Automatic — winner’s darkest brand colour'}
        </span>
        <CopyIconButton text={copyText(name, teamId, rawHex)} label={`Copy ${name} stamp-ink context`} />
        <button type="button" className="colorlab__wparesetbtn" onClick={reset} disabled={!rawHex}>
          Reset to automatic
        </button>
        <button type="button" className="colorlab__wparesetbtn" onClick={save} disabled={!dirty}>
          Save ink
        </button>
      </div>

      <p className="idlab__stampplacewarn">
        Applies to every stamp this club wins, including ones already minted — still walked through the same
        contrast floor the automatic pick uses, so a light colour still prints legibly if it needs to darken.
      </p>

      <div className="idlab__stampinkrow">
        <div className="idlab__stampplaceart">
          <GameStamp
            game={game}
            instanceId={`idlab-ink-${teamId}`}
            inkOverride={rawHex}
            title={`${name}’s stamp ink`}
          />
        </div>

        <div className="idlab__stampinkfield">
          <label>
            <span>Ink</span>
            <HexField placeholder="automatic" value={rawHex} onChange={onField} />
          </label>
          {pressed && (
            <p className="idlab__monoinkhint">
              As pressed: <code>{pressed}</code>
              {wasDeepened ? ' (deepened for contrast)' : ''} —{' '}
              {contrast.toFixed(2)}:1 on stamp paper
            </p>
          )}
        </div>
      </div>

      {saveState && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${saveState.kind === 'busy' ? 'note' : saveState.kind}`}>
          {saveState.text}
        </p>
      )}
    </section>
  )
}

// The same snippet every other editor's copy icon produces: which club, which
// file, and the value to land there.
function copyText(name, teamId, rawHex) {
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Where: src/lib/data/stamp-ink.json\n` +
    (rawHex ? `"${teamId}": "${rawHex}"` : `(no override — automatic)`)
  )
}
