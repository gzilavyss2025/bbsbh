import { ClubPicker } from '../../../components/account/ClubPicker.jsx'

// Baseball — the preference that is about the sport rather than the device:
// which club you follow.
//
// It writes straight through `usePreferences().set`, which validates against
// the closed field registry, stamps `Date.now()`, persists, and echoes to every
// other mounted instance. There is no Save button anywhere in My Tally: a tap
// IS the change, exactly as it is in the welcome modal. Signed in,
// PreferencesCloudSync publishes it on the next comparison.
//
// "Level the slate opens on" used to sit below the club strip and is gone. The
// slate's league lives in the URL now (ADR-0056) so that a link can name it,
// which leaves no question for a setting to answer — the address already
// answers it, out loud, for whoever opens it. The stored `level` field is kept
// in the preference registry for older devices still publishing one; nothing
// reads it. See src/lib/account/preferences.js.
//
// The club strip is `ClubPicker` — the same component the first-visit intro
// renders — and the club list arrives as a prop from the page, which reads the
// same-origin static club file rather than statsapi. /profile touches no game
// data and issues no request to a ballpark's feed; keep it that way.
//
export function ClubSection({ teams, club, onPickClub }) {
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
    </section>
  )
}
