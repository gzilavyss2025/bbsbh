import { useMemo, useState } from 'react'
import { GameStamp } from '../../../components/logbook/GameStamp.jsx'
import { CopyIconButton } from '../../../components/ui/CopyBox.jsx'
import { hasMonoLogo } from '../../../lib/teams.js'
import {
  MARK_PLACEMENT_DEFAULT,
  MARK_PLACEMENT_LIMITS,
  MARK_SIDES,
  resolveMarkPlacement,
} from '../../../lib/stampArt.js'
import { stampLogoTuningRecord, stampLogoTuningStore } from '../../../lib/stampLogoTuning.js'
import { saveStores } from '../saveStores.js'
import { shiftStepKeys } from './numberSteps.js'

// Place a club's knockout mark inside a Logbook stamp — the hand correction to
// "letterbox it into a 150x150 square", which is right for most marks and
// visibly wrong for a tall cap logo or a wide wordmark (ADR-0035; the geometry
// and its clamps live in src/lib/stampArt.js's "Per-club mark placement"
// block, the store in src/lib/data/stamp-logo-tuning.json).
//
// Tuned per SIDE, and judged per side, because the two slots are not mirror
// images of one thing: the away mark bleeds off the clip circle's left edge and
// the home mark off its right, so a nudge that rescues one can ruin the other.
// Hence two previews rather than one — the club as the away club, and the same
// club as the home club, each beside its own four knobs.
//
// The previews are REAL stamps, not mock-ups (the same discipline the Knockout
// mark editor keeps): the club's tuning-in-progress is handed to GameStamp as
// its `placements` prop, so what you are looking at is the actual art with the
// actual mask, and Save only decides whether everyone else sees it too. The
// game those stamps draw is fabricated right here — a fixed date, a made-up
// ballpark, two invented run totals — and reaches no schedule, feed or
// collection; that is what makes this a safe fourth name on
// scripts/check-stamp-surfaces.mjs's allowlist, along with the lab being
// DEV-only and dropped from a production build entirely (App.jsx).
//
// Applies to any club with a precomputed knockout mark, which is to say MLB and
// every full-season MiLB level alike — the store is keyed by team id and knows
// nothing about levels.
//
// WORTH SAYING OUT LOUD: a stamp keeps game facts and no art, so it is redrawn
// from these numbers on every render. Saving a change here restyles that club's
// stamps everywhere the moment it ships — including keepsakes already minted
// and placed in other people's passport books. That is the intended behaviour
// (one club, one placement, forever), not a bug, but it is why the fields clamp
// and why the reference preview is worth trusting before you save.

const FIELDS = [
  { key: 'scale', label: 'Scale' },
  { key: 'offsetX', label: 'X' },
  { key: 'offsetY', label: 'Y' },
  { key: 'rotation', label: 'Rotation' },
]

const SIDE_LABEL = { away: 'Away', home: 'Home' }
// Spelled out rather than derived from SIDE_LABEL, because deriving it means a
// `.toLowerCase()` on rendered text — which the casing guard rejects, and
// rightly (ADR-0017).
const SIDE_SLOT_PHRASE = { away: 'away slot', home: 'home slot' }

// The other half of each preview stamp. Deliberately id-less: with no team id
// there is no knockout file to mask, so GameStamp falls back to the bold
// abbreviation — which is exactly what you want opposite the mark you are
// judging, since it can't be mistaken for it.
const OPPONENT = { abbreviation: 'OPP', runs: 3 }

// A stamp needs a game. This one is invented, and its gamePk is a constant so
// the wear filter's turbulence seed doesn't re-chew the ink on every keystroke.
const PREVIEW_GAME = { gamePk: 502, date: '2026-08-02', venue: 'Preview Ballpark', innings: 9 }

export function StampPlacementEditor({ teamId, name, abbreviation }) {
  // `edited` stays null until something is actually typed, so the landed record
  // is the baseline rather than a copy of it — the same "null means untouched"
  // contract MonoInkEditor keeps, made safe the same way (ClubWorkbench mounts
  // this per club with a `key`).
  const [edited, setEdited] = useState(null)
  const [saveState, setSaveState] = useState(null)

  const landed = useMemo(
    () => Object.fromEntries(MARK_SIDES.map((side) => [side, resolveMarkPlacement(stampLogoTuningRecord(teamId, side))])),
    [teamId],
  )
  const placement = edited ?? landed

  const dirty = MARK_SIDES.some((side) =>
    FIELDS.some(({ key }) => resolveMarkPlacement(placement[side])[key] !== landed[side][key]),
  )

  function setField(side, field, value) {
    setEdited((prev) => ({ ...(prev ?? landed), [side]: { ...(prev ?? landed)[side], [field]: value } }))
    setSaveState(null)
  }

  function resetSide(side) {
    setEdited((prev) => ({ ...(prev ?? landed), [side]: { ...MARK_PLACEMENT_DEFAULT } }))
    setSaveState(null)
  }

  async function save() {
    setSaveState({ kind: 'busy', text: 'Saving' })
    const store = structuredClone(stampLogoTuningStore())
    const key = String(teamId)
    const treatments = {}
    for (const side of MARK_SIDES) {
      const resolved = resolveMarkPlacement(placement[side])
      const note = store[key]?.treatments?.[side]?.note
      // A club back at its defaults carries no record at all — an absent entry
      // and an identity entry render the same, and the shorter store is the one
      // that says which clubs actually needed a hand. A note is prose somebody
      // wrote, so it survives on its own.
      const isDefault = FIELDS.every(({ key: field }) => resolved[field] === MARK_PLACEMENT_DEFAULT[field])
      if (isDefault && !note) continue
      treatments[side] = note === undefined ? resolved : { ...resolved, note }
    }
    if (Object.keys(treatments).length === 0) delete store[key]
    else store[key] = { name, treatments, ...(store[key]?.note ? { note: store[key].note } : null) }

    const ok = await saveStores([{ key: 'stamp-logo-tuning', body: store }])
    setSaveState(
      ok
        ? { kind: 'ok', text: 'saved — every stamp for this club redraws from it' }
        : { kind: 'error', text: 'could not write stamp-logo-tuning.json — is `npm run dev` running?' },
    )
  }

  if (!hasMonoLogo(teamId)) {
    return (
      <Panel>
        No knockout mark on file for this club, so a stamp draws its bold abbreviation instead — there is
        nothing here to place. Generate the mark first (scripts/gen-mono-logos.mjs).
      </Panel>
    )
  }

  return (
    <section className="idlab__stampplace" aria-label="Stamp placement">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Stamp placement</span>
        <span className="idlab__monoinkhint">Where this club&rsquo;s knockout mark sits on a Logbook stamp</span>
        <CopyIconButton
          text={copyText(name, teamId, placement)}
          label={`Copy ${name} stamp-placement context`}
        />
        <button type="button" className="colorlab__wparesetbtn" onClick={save} disabled={!dirty}>
          Save placement
        </button>
      </div>

      <p className="idlab__stampplacewarn">
        Saved placement applies to every stamp of this club, including ones already minted and placed in a
        Logbook — a stamp stores the game, never the art, so it redraws from these numbers each time.
      </p>

      <div className="idlab__stampplacerow">
        {MARK_SIDES.map((side) => (
          <SidePanel
            key={side}
            side={side}
            teamId={teamId}
            name={name}
            abbreviation={abbreviation}
            values={placement[side]}
            landed={landed[side]}
            placements={placement}
            onField={(field, value) => setField(side, field, value)}
            onReset={() => resetSide(side)}
          />
        ))}
      </div>

      {saveState && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${saveState.kind === 'busy' ? 'note' : saveState.kind}`}>
          {saveState.text}
        </p>
      )}
    </section>
  )
}

// One side: the club in that slot on a real stamp, and the four knobs that move
// it there. The stamp is drawn with BOTH sides' current values, so the pair of
// panels shows the same two decisions from each end rather than two independent
// mock-ups.
function SidePanel({ side, teamId, name, abbreviation, values, landed, placements, onField, onReset }) {
  const club = { id: teamId, abbreviation, runs: 4 }
  const game = {
    ...PREVIEW_GAME,
    away: side === 'away' ? club : OPPONENT,
    home: side === 'home' ? club : OPPONENT,
  }
  const resolved = resolveMarkPlacement(values)
  const moved = FIELDS.some(({ key }) => resolved[key] !== landed[key])

  return (
    <div className="idlab__stampplaceside">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">{SIDE_LABEL[side]} slot</span>
        {moved && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      <div className="idlab__stampplaceart">
        <GameStamp
          game={game}
          instanceId={`idlab-${teamId}-${side}`}
          placements={placements}
          title={`${name} in a stamp's ${SIDE_SLOT_PHRASE[side]}`}
        />
      </div>

      <div className="colorlab__posinlinefields">
        {FIELDS.map(({ key, label }) => {
          const limits = MARK_PLACEMENT_LIMITS[key]
          return (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                step={limits.step}
                min={limits.min}
                max={limits.max}
                // A cleared field is an empty input, never NaN — the preview
                // beside it falls back to that field's default meanwhile
                // (resolveMarkPlacement), so clearing one shows what dropping
                // it would look like rather than blanking the mark.
                value={Number.isFinite(values[key]) ? values[key] : ''}
                onChange={(e) => onField(key, Number(e.target.value))}
                onKeyDown={shiftStepKeys(values[key], limits.step, (v) => onField(key, v))}
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}

// The same snippet every other editor's copy icon produces: which club, which
// file, and the record to land there.
function copyText(name, teamId, placement) {
  const lines = MARK_SIDES.map((side) => {
    const p = resolveMarkPlacement(placement[side])
    return `  "${side}": { "scale": ${p.scale}, "offsetX": ${p.offsetX}, "offsetY": ${p.offsetY}, "rotation": ${p.rotation} }`
  })
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Where: src/lib/data/stamp-logo-tuning.json — ${teamId}.treatments\n` +
    `{\n${lines.join(',\n')}\n}`
  )
}

function Panel({ children }) {
  return (
    <section className="idlab__stampplace" aria-label="Stamp placement">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Stamp placement</span>
      </div>
      <p className="idlab__monoinkhint">{children}</p>
    </section>
  )
}
