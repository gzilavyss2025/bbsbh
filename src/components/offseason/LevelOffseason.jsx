import { MovedUp } from './MovedUp.jsx'
import { PickedGame } from './PickedGame.jsx'
import { SeasonRecord } from './SeasonRecord.jsx'
import { WinterCalendar } from './WinterCalendar.jsx'
import { YoungestRegulars } from './YoungestRegulars.jsx'
import { SPORT_LABEL } from '../../lib/teams.js'

// THE OFFSEASON PAGE, ONE LEVEL DOWN — issue #1077, step 3 of #1038.
//
// The minor levels go dark far longer than MLB does, and far earlier. Measured
// across 2025-26: the MLB tab had no played game for 110 days, against 175 at
// AAA, 179 at AA and 196-197 at the two A levels, the last of which went quiet
// in the middle of September. For a third of the year these four tabs have said
// "No games scheduled." and nothing else.
//
// This is not OffseasonLead with a different heading. The wire leads the MLB
// page because from November to February the wire is the most-read thing in
// baseball; at High-A in December it is close to silent, and the rail's own
// 48-hour rule already drops it. So the lead here is the thing that IS true of
// a minor level the week its season ends: who left it going up.
//
// The shell does not change — club strip, level tabs and date banner stay
// exactly where they are in season, as they do on the MLB page. What changes is
// the empty games area, and only that.
//
// FOUR THINGS, IN THE DESIGN'S ORDER. The card on top offers a checked game
// from the season that just ended — the page's one action, and the reason a
// scorer opens it in December (PickedGame.jsx). The list under it says what
// became of the people in games like it. The notebook note then asks one
// question about the league as a whole (YoungestRegulars.jsx), and the record
// row at the foot is the one door on the page that opens onto results
// (SeasonRecord.jsx, issue #1078). Any of the first three can be absent without
// the others noticing: a level whose pool has not been generated yet shows the
// list alone, which is exactly what this page was when it first shipped.
export function LevelOffseason({ sportId, winter, dateStr, children }) {
  const label = SPORT_LABEL[sportId] ?? ''

  return (
    <section
      className="oseason oseason--level"
      aria-label={`The ${winter.seasonEnded} ${label} offseason`}
    >
      <div className="oseason__head">
        {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
            invariant is never a per-component .toUpperCase() (ADR-0017). */}
        <h2 className="oseason__title oseason__title--page">{label} offseason</h2>
        <p className="oseason__note">{winter.seasonEnded} season</p>
      </div>

      <PickedGame sportId={sportId} season={winter.seasonEnded} dateStr={dateStr} />

      <MovedUp sportId={sportId} season={winter.seasonEnded} />

      <YoungestRegulars sportId={sportId} season={winter.seasonEnded} />

      <SeasonRecord sportId={sportId} season={winter.seasonEnded} />

      {/* The same strip the MLB page carries, and mostly the same dates: the
          Rule 5 draft and the 40-man deadline are minor-league events that MLB
          clubs attend. It filters itself to the winter on screen, so a level
          whose winter opened in September simply shows more of the typed
          calendar than MLB's does — and Opening Day, which is checkable, is
          appended by the strip. Spring training is not: there is no minor-
          league spring row to append. */}
      <WinterCalendar winter={winter} />

      {/* The countdown, on a phone. Wide, it takes the rail slot and GameSelect
          mounts it there instead — so it is passed in rather than rendered
          here, and only one of the two ever exists. */}
      {children}
    </section>
  )
}
