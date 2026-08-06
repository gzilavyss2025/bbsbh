import { ClubPicker } from '../../../components/account/ClubPicker.jsx'
import { LEVELS } from '../../../lib/teams.js'

// Baseball — the two preferences that are about the sport rather than the
// device: which club you follow, and which level the slate opens on.
//
// Both write straight through `usePreferences().set`, which validates against
// the closed field registry, stamps `Date.now()`, persists, and echoes to every
// other mounted instance. There is no Save button anywhere in My Tally: a tap
// IS the change, exactly as it is in the welcome modal and on the slate's level
// toggle. Signed in, PreferencesCloudSync publishes it on the next comparison.
//
// The club strip is `ClubPicker` — the same component the first-visit intro
// renders — and the club list arrives as a prop from the page, which reads the
// same-origin static club file rather than statsapi. /profile touches no game
// data and issues no request to a ballpark's feed; keep it that way.
//
// `level` is a statsapi sportId, which is what `LEVELS` and every fetch in the
// app already speak. It is deliberately not a second string vocabulary that
// would drift from this one.
export function ClubSection({ teams, club, level, onPickClub, onPickLevel }) {
  return (
    <section className="mytally__section">
      <h2 className="mytally__sectiontitle">Baseball</h2>

      <div className="mytally__field">
        {/* The club NAME is not repeated here — the masthead directly above
            already prints it beside the seal, and saying it twice in one
            viewport reads as a bug rather than as emphasis. The picker's own
            active state is what answers "which one is chosen" at this
            distance. */}
        <p className="mytally__fieldlabel">Your club</p>
        <p className="mytally__fieldnote caps-exempt">
          Pinned to the top of the slate, and the mark on your account button.
        </p>
        {teams.length > 0 ? (
          <ClubPicker teams={teams} value={club} onPick={onPickClub} ariaLabel="Your club" />
        ) : (
          // The static club file ships with the build, so this is a
          // storage/network oddity rather than a normal state — say so plainly
          // instead of rendering an empty strip that looks broken.
          <p className="hint caps-exempt">The club list isn’t available right now.</p>
        )}
      </div>

      <div className="mytally__field">
        <p className="mytally__fieldlabel">Level the slate opens on</p>
        <div className="mytally__choices" role="group" aria-label="Level the slate opens on">
          {LEVELS.map((entry) => (
            <button
              key={entry.sportId}
              type="button"
              className={`mytally__choice${entry.sportId === level ? ' is-active' : ''}`}
              aria-pressed={entry.sportId === level}
              onClick={() => onPickLevel(entry.sportId)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="mytally__fieldnote caps-exempt">
          Minor-league feeds are thinner than MLB’s — a lineup or a weather line is
          sometimes simply not posted yet.
        </p>
      </div>
    </section>
  )
}
