import { teamChipColors, teamFullName } from '../../lib/teams.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { ClubPicker } from '../account/ClubPicker.jsx'

// Which club's colours theme a Game Log book's cover (ADR-0036's shelf,
// PassportCover.jsx's `book.coverTeamId`). A THIN WRAPPER around ClubPicker —
// src/CLAUDE.md calls that file "the one club strip... Do not grow a second
// one" — so every bit of team-list rendering, search, and keyboard traversal
// here is ClubPicker's own, untouched. This file adds exactly two things
// ClubPicker doesn't already do: an explicit "match my favourite team"
// option, and a live preview swatch of the pair PassportCover would actually
// paint the board in.
//
// This is only the reusable control. Wiring it into a real book-creation or
// -editing screen is a later phase; today nothing calls it yet.
//
// PROPS
//   value     number | null — the book's current `coverTeamId`. `null` means
//             "no override", exactly as PassportCover.jsx reads it: the cover
//             falls back to the user's own favourite team.
//   onChange  (teamId: number | null) => void. Fired on every pick, the same
//             no-Save-step contract ClubPicker itself already has.
//   teams     `[{ id, name }]`, passed straight through to ClubPicker. This
//             component fetches nothing of its own — same posture ClubPicker
//             takes, for the same reason: its two existing hosts (the intro
//             modal, /profile) legitimately want different sources for that
//             list, and a caller of THIS component gets to make that same
//             choice rather than being handed one baked in here.
export function CoverColorPicker({ teams = [], value = null, onChange, ariaLabel = 'Cover colour' }) {
  const { favoriteTeamId } = useFavoriteTeam()

  // Matching the favourite is its own explicit choice, not merely "nothing
  // picked yet" — a book that resolves to a club today should keep resolving
  // to whichever club is the favourite LATER, even after that changes. So it
  // is offered as one more option in the same row rather than a default
  // ClubPicker would show by highlighting nothing.
  const matchingFavorite = value == null

  // The preview reads the SAME resolved id PassportCover.jsx would use: the
  // override when there is one, the favourite when there isn't. One resolver
  // (`teamChipColors`), reused rather than re-derived, so this swatch can
  // never show a pair the cover itself would not actually paint.
  const previewTeamId = matchingFavorite ? favoriteTeamId : value
  const previewColors = teamChipColors(previewTeamId)
  const previewName = matchingFavorite ? teamFullName(favoriteTeamId) : teamFullName(value)

  return (
    <div className="covercolorpicker">
      <div className="covercolorpicker__row">
        <button
          type="button"
          className={`covercolorpicker__favorite${matchingFavorite ? ' is-active' : ''}`}
          aria-pressed={matchingFavorite}
          onClick={() => onChange?.(null)}
        >
          Match my favorite team
        </button>

        {/* A club with no colour on file (an unaffiliated/complex-league id)
            answers null from teamChipColors — the same degrade PassportCover
            itself takes, so the swatch is simply dropped rather than drawn
            blank. */}
        {previewColors && (
          <span className="covercolorpicker__preview" aria-hidden="true">
            <span
              className="covercolorpicker__swatch"
              style={{
                '--swatch-ink': previewColors.primary,
                '--swatch-foil': previewColors.text,
              }}
            />
            {previewName && <span className="covercolorpicker__previewname">{previewName}</span>}
          </span>
        )}
      </div>

      <ClubPicker teams={teams} value={value} onPick={onChange} ariaLabel={ariaLabel} />
    </div>
  )
}
