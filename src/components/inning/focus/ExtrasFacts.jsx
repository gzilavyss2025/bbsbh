import { Fragment, useMemo } from 'react'
import { selectGameInfo, selectOfficials } from '../../../api/select.js'
import { scorebookDate } from '../../../lib/dates.js'
import { ManagerLink } from '../../team/ManagerLink.jsx'
import { UmpireLink } from '../../umpire/UmpireLink.jsx'

// The fill-in half of focus mode's EXTRAS tab (ReferencePanel.jsx): the
// scorecard-header facts a hand-scorer writes down once and then looks up
// again mid-game — who is managing, what each club is wearing, who is working
// the plate, and when, where and in what weather the game is being played.
// They used to live only on the lineup pages, two taps and a lost place away
// from the half being scored.
//
// SPOILER FOOTING: every value here comes from `api/select.js`, the
// spoiler-FREE module (ADR-0001), read at this component's top level exactly
// as the pre-game lineup page reads the same two selectors (TeamInfo.jsx). A
// crew assignment, a jersey, a first-pitch time and a temperature are facts
// about the STAGING of a game and never about its score, so nothing here sits
// behind a seal and nothing here needs one. `managers` / `uniforms` /
// `scorebookWeather` arrive as already-resolved props from GameView, which is
// where the box score and both lineup pages get the same three.
//
// ORDER, top to bottom: the clubs (whose benches are the cards directly above
// this), then the crew, then the game itself. The four game facts keep the
// lineup page's own order — Date, Ballpark, First pitch, Weather — rather than
// inventing a second one for the same four cells.
export function ExtrasFacts({ feed, meta, managers, uniforms, scorebookWeather }) {
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const officials = useMemo(() => selectOfficials(feed), [feed])

  return (
    <>
      <section className="refextras">
        <h3 className="section__title">Clubs</h3>
        {/* One row per club, manager beside uniform. The club is named by
            ABBREVIATION: this grid is two cells wide in a ~300px rail, and a
            label reading "DIAMONDBACKS MANAGER" wraps to three lines where
            "AZ MANAGER" fits on one. */}
        <dl className="factgrid refextras__grid">
          {['away', 'home'].map((side) => (
            <Fragment key={side}>
              <Fact
                label={`${clubTag(meta, side)} manager`}
                value={managerFact(managers?.[side])}
              />
              <Fact label={`${clubTag(meta, side)} uniform`} value={uniforms?.[side]} />
            </Fragment>
          ))}
        </dl>
      </section>

      {/* The crew, in the lineup page's own markup and roles order (HP first,
          then the bases, then the two extra outfield spots a postseason /
          All-Star six-man crew adds — see selectOfficials). Each name links to
          that umpire's page; the plate umpire's accuracy TIER deliberately
          does not ride along, unlike the lineup page's card — it loads on its
          own, and a reference tab a scorer flips open mid-half is the wrong
          place to start a fetch that answers a question nobody asked here. */}
      {officials.length > 0 && (
        <section className="umps refextras">
          <h3 className="section__title">Umpires</h3>
          <ul className="umps__list">
            {officials.map((o) => (
              <li key={o.role}>
                <span className="umps__role">{o.role}</span>
                <span className="umps__namerow">
                  <UmpireLink id={o.id} className="umps__name">
                    {o.name}
                  </UmpireLink>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="refextras">
        <h3 className="section__title">Game</h3>
        <dl className="factgrid refextras__grid">
          <Fact label="Date" value={scorebookDate(info.officialDate)} />
          {/* The feed appends a period to the venue name ("Busch Stadium.") —
              drop it, same as the box score does. */}
          <Fact label="Ballpark" value={info.venue.replace(/\.\s*$/, '')} />
          {/* The scheduled start until the box score's own "First pitch" info
              line posts once the game is under way, at which point the actual
              time overwrites the estimate in the same cell. */}
          <Fact label="First pitch" value={info.firstPitch || info.scheduledTime} />
          {/* Outdoor scorebook weather from the park's lat/lon (see
              scripts/gen-weather + weather.js) — the value worth copying onto
              paper. Falls back to the feed's own reading, which for a closed
              roof is the interior one, when the generator has nothing (a MiLB
              park with no coordinates). */}
          <Fact label="Weather" value={scorebookWeather?.text || info.weather} />
        </dl>
      </section>
    </>
  )
}

// The club's abbreviation, or its side when a feed hasn't posted one (MiLB
// degrades this way — see the root CLAUDE.md's graceful-degradation rule), so
// the label never reads " MANAGER" with a hole at the front.
function clubTag(meta, side) {
  return meta?.[side]?.abbreviation || (side === 'away' ? 'Away' : 'Home')
}

// Surname-first name with the uniform number inked in seam red and an interim
// appointment marked, the same shape the lineup page's Manager fact uses.
function managerFact(manager) {
  if (!manager) return null
  return (
    // The fact PRINTS surname-first; the address takes spoken order
    // (ADR-0057), which `name` on the same object already is.
    <ManagerLink id={manager.personId} name={manager.name} className="fact__person">
      {manager.lastFirst}
      {manager.jersey ? <span className="fact__jersey">{manager.jersey}</span> : null}
      {manager.interim ? <span className="fact__note">interim</span> : null}
    </ManagerLink>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value || <span className="fact__na">—</span>}</dd>
    </div>
  )
}
