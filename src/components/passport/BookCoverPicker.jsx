import '../../styles/49-passport-book.css'
import '../../styles/58-logbook-shelf.css'
import { useId, useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { WIDE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery.js'
import { fetchStaticTeams } from '../../api/teams-static.js'
import { COVER_COLORS } from '../../lib/books.js'
import { LEVELS, SPORT_IDS } from '../../lib/teams.js'
import { ClubPicker } from '../account/ClubPicker.jsx'
import { LevelNav } from '../team/LevelNav.jsx'
import { PassportCover } from './PassportCover.jsx'
import { LEAGUE_MARK_LABELS, leagueMarkBox, leagueMarkUrl } from './leagueMarks.js'

// How a Game Log book's cover is chosen — the one picker, used by the
// create-a-book page and by a book's Settings sheet, so the two can never
// drift into subtly different pickers.
//
// It writes three fields of src/lib/books.js's record and reads back the whole
// draft to draw the preview:
//
//   coverMark   'team' | 'mlb' | 'milb' — a club crest, or a league mark
//   coverColor  'kraft' | 'red' | 'blue' — the board a LEAGUE mark prints on
//   coverTeamId the club, when the mark is 'team'. Kept on the record through
//               a league-mark detour, so switching back never asks the user to
//               pick their club a second time.
//
// THE PREVIEW IS `PassportCover`, not a picture of one. Reusing the real cover
// component (in its `preview` mode) is what makes "what you see is what the
// shelf will show" true by construction rather than by two files agreeing.
// It takes the whole draft `book`, so a title typed into the page above
// updates it on the same render as a colour tapped down here.
//
// TWO LAYOUTS, ONE SET OF CHOICES. Wide screens show both halves at once —
// the six league presets on the left, the club rail on the right — because
// there is room to see every option and compare them. A phone gets a stepper
// instead: three or four options a step, each step one decision, the preview
// pinned above all of it. That is a real difference in what fits on the
// screen, not a style preference, so it branches on the layout breakpoint
// (the app's one WIDE_QUERY, src/hooks/useMediaQuery.js) rather than
// shipping the stepper to both and calling it consistent.
//
// The club list is `fetchStaticTeams()` — the same-origin static file, not a
// live statsapi request, and cached in-module, so mounting this beside an
// already-fetched instance costs nothing. Unlike the picker this replaces, it
// reads EVERY level's clubs (MLB through A), not only MLB: a book may be
// covered in an affiliate's colours.

const COLOR_LABELS = { kraft: 'Kraft', red: 'Red', blue: 'Blue' }

const LEAGUE_ORDER = ['mlb', 'milb']

// A stable identity for "not loaded yet", so the memo below doesn't rebuild
// on every render before the club file lands.
const EMPTY_BY_SPORT = {}

// One league mark, foil-stamped on one board — the same mask-over-currentColor
// recipe the cover itself uses, at chip size. Drawn rather than described so a
// preset reads as the cover it makes.
function PresetChip({ mark }) {
  // Per instance, because SVG ids are global to the document and three chips
  // of the same mark sit on this page at once (GameStamp.jsx's rule).
  const maskId = `coverpick-${useId().replace(/:/g, '')}`
  const box = leagueMarkBox(mark)
  const href = leagueMarkUrl(mark)
  if (!box || !href) return <span className="coverpick__presetfallback">{LEAGUE_MARK_LABELS[mark]}</span>
  return (
    <svg viewBox={box.join(' ')} className="coverpick__presetmark" aria-hidden="true" focusable="false">
      <defs>
        <mask id={maskId}>
          <image href={href} x={box[0]} y={box[1]} width={box[2]} height={box[3]} preserveAspectRatio="xMidYMid meet" />
        </mask>
      </defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

function PresetGrid({ book, onChange }) {
  return (
    <div className="coverpick__presets" role="group" aria-label="League logo covers">
      {LEAGUE_ORDER.map((mark) =>
        COVER_COLORS.map((color) => {
          const active = book?.coverMark === mark && (book?.coverColor ?? 'kraft') === color
          return (
            <button
              key={`${mark}-${color}`}
              type="button"
              className={`coverpick__preset passcover--board-${color}${active ? ' is-active' : ''}`}
              aria-pressed={active}
              aria-label={`${LEAGUE_MARK_LABELS[mark]} logo on ${COLOR_LABELS[color]}`}
              onClick={() => onChange({ coverMark: mark, coverColor: color })}
            >
              <PresetChip mark={mark} />
            </button>
          )
        }),
      )}
    </div>
  )
}

function ColorRow({ book, onChange }) {
  return (
    <div className="coverpick__colors" role="group" aria-label="Board color">
      {COVER_COLORS.map((color) => {
        const active = (book?.coverColor ?? 'kraft') === color
        return (
          <button
            key={color}
            type="button"
            className={`coverpick__color passcover--board-${color}${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange({ coverColor: color })}
          >
            {COLOR_LABELS[color]}
          </button>
        )
      })}
    </div>
  )
}

export function BookCoverPicker({ book, onChange }) {
  const clubs = useAsync(fetchStaticTeams, [])
  const wide = useMediaQuery(WIDE_QUERY)
  const bySportId = clubs.data?.bySportId ?? EMPTY_BY_SPORT

  // Which level a club belongs to, so a book already covered in an affiliate's
  // colours opens the rail on that affiliate's level rather than on MLB.
  const levelOfTeam = useMemo(() => {
    const out = new Map()
    for (const level of LEVELS) {
      for (const team of bySportId[String(level.sportId)] ?? []) out.set(team.id, level.sportId)
    }
    return out
  }, [bySportId])

  const [levelPick, setLevelPick] = useState(null)
  const level = levelPick ?? levelOfTeam.get(book?.coverTeamId) ?? SPORT_IDS.MLB
  const teams = bySportId[String(level)] ?? []

  // The phone stepper's position. 0 is always "what goes on the cover"; what 1
  // and 2 mean depends on the answer, which is why this is a depth and not a
  // named screen.
  const [step, setStep] = useState(0)
  const usingClub = (book?.coverMark ?? 'team') === 'team'

  const pickMark = (coverMark) => {
    onChange(coverMark === 'team' ? { coverMark } : { coverMark, coverColor: book?.coverColor ?? 'kraft' })
    setStep(1)
  }

  const preview = (
    <div className="coverpick__preview">
      <PassportCover book={book} preview />
    </div>
  )

  if (wide) {
    return (
      <div className="coverpick">
        {preview}
        <div className="coverpick__halves">
          <section className="coverpick__half">
            <h3 className="coverpick__heading">Use a league logo</h3>
            <PresetGrid book={book} onChange={onChange} />
          </section>
          <section className="coverpick__half">
            <h3 className="coverpick__heading">Use team colors</h3>
            <LevelNav sportId={level} onChange={setLevelPick} />
            <button
              type="button"
              className={`coverpick__favorite${usingClub && book?.coverTeamId == null ? ' is-active' : ''}`}
              aria-pressed={usingClub && book?.coverTeamId == null}
              onClick={() => onChange({ coverMark: 'team', coverTeamId: null })}
            >
              Match my favorite team
            </button>
            <ClubPicker
              teams={teams}
              value={usingClub ? book?.coverTeamId : null}
              onPick={(coverTeamId) => onChange({ coverMark: 'team', coverTeamId })}
              ariaLabel="Cover club"
            />
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="coverpick">
      {preview}
      {step > 0 && (
        <button type="button" className="coverpick__back" onClick={() => setStep((n) => n - 1)}>
          ‹ Back
        </button>
      )}

      {step === 0 && (
        <div className="coverpick__steps" role="group" aria-label="What goes on the cover">
          <button type="button" className="coverpick__step" onClick={() => pickMark('team')}>
            Use team colors
          </button>
          <button type="button" className="coverpick__step" onClick={() => pickMark('mlb')}>
            Use MLB logo
          </button>
          <button type="button" className="coverpick__step" onClick={() => pickMark('milb')}>
            Use MiLB logo
          </button>
        </div>
      )}

      {step === 1 && usingClub && (
        <>
          <h3 className="coverpick__heading">Pick a level</h3>
          <LevelNav
            sportId={level}
            onChange={(sportId) => {
              setLevelPick(sportId)
              setStep(2)
            }}
          />
          <button
            type="button"
            className={`coverpick__favorite${book?.coverTeamId == null ? ' is-active' : ''}`}
            aria-pressed={book?.coverTeamId == null}
            onClick={() => onChange({ coverMark: 'team', coverTeamId: null })}
          >
            Match my favorite team
          </button>
        </>
      )}

      {step === 1 && !usingClub && (
        <>
          <h3 className="coverpick__heading">Pick a color</h3>
          <ColorRow book={book} onChange={onChange} />
        </>
      )}

      {step === 2 && usingClub && (
        <>
          <h3 className="coverpick__heading">Pick a club</h3>
          <ClubPicker
            teams={teams}
            value={book?.coverTeamId ?? null}
            onPick={(coverTeamId) => onChange({ coverMark: 'team', coverTeamId })}
            ariaLabel="Cover club"
          />
        </>
      )}
    </div>
  )
}
