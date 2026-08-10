import { useState } from 'react'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// A career map, shown above the "Path to the Majors" card: one stop per club
// the player logged real time with (see careerTimelineView's threshold),
// earliest first. Each stop is the club's logo floated on a soft wash of its
// OWN colors — so no border or drop shadow is needed to set the mark off the
// page (see fetchTeamLogoTint) — with the year(s) he spent there beneath it.
// Stops wrap onto multiple rows for a long career rather than scrolling — the
// column count is CSS's call (`repeat(auto-fill, …)`, see
// 05a-career-timeline.css), not JS's: `.screen` itself widens at the
// tablet/desktop breakpoint, so a column count fixed for the phone width
// would leave a wide screen's row mostly empty.
//
// An MLB stop is INKED, no level tag — ink already reads as "the majors".
// A MiLB stop is PENCILED (graphite caption, hairline badge ring) with its
// level (AAA / AA / … / ROK) as a small bordered pill underneath — same
// official-vs-provisional convention the career register uses
// (26-player-page.css's "MLB (inked) + MiLB (penciled) rows"), so the two
// competitions read apart at a glance without leaning on that pill alone.
// `careerTimelineView` (careerRegister.js) sets `tier`; the reused
// "Affiliation history" strip below never sets it — every stop there is by
// definition an MLB parent org, so the untagged default (inked, no pill) is
// already the right rendering.
//
// Reused by the MiLB team page as an "Affiliation history" strip (each stop an
// MLB parent org rather than a player's club) — hence the `title` prop; the
// visual treatment is identical by request.
//
// A MiLB stop with a resolved affiliate (enrichTimelineEntries sets
// `affiliateTeamId`/`affiliateName`/`affiliateTint`) swaps its badge to that
// MLB org's own logo and tint. Two independent triggers feed the same
// "show the affiliate" decision (`hoverKey === key || pinned.has(key)`):
// hovering previews it on a device that has hover, reverting the instant the
// pointer leaves; clicking (== tapping, on a device that has no hover) toggles
// a separate pinned set, an on/off state that survives past pointer-leave. A
// real mouse gets both — hover for a quick look, click to leave it up — and a
// touch tap gets only the click half, which is exactly the on/off toggle it
// needs since touch fires no reliable hover. Deliberately no discoverability
// affordance (no corner icon, no first-run hint) — asked for the interaction
// itself, not a way to advertise it.

export function CareerTimeline({ entries, title = 'Team history' }) {
  const [hoverKey, setHoverKey] = useState(null)
  const [pinned, setPinned] = useState(() => new Set())
  if (!entries?.length) return null

  const togglePin = (key) =>
    setPinned((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <section className="careertl">
      <h3 className="section__title"><span>{title}</span></h3>
      <ol className="careertl__track">
        {entries.map((e) => {
          const key = `${e.teamId}-${e.minSeason}`
          const swappable = Boolean(e.affiliateTeamId)
          const isFlipped = swappable && (hoverKey === key || pinned.has(key))
          const badgeTeamId = isFlipped ? e.affiliateTeamId : e.teamId
          const badgeName = isFlipped ? e.affiliateName : e.teamName
          const badgeTint = isFlipped ? e.affiliateTint ?? e.tint : e.tint
          const Badge = swappable ? 'button' : 'span'
          return (
            <li
              className={`careertl__stop ${e.tier === 'milb' ? 'careertl__stop--milb' : ''}`}
              key={key}
              title={e.title}
            >
              <Badge
                type={swappable ? 'button' : undefined}
                className="careertl__badge"
                style={badgeTint ? { background: badgeTint } : undefined}
                onMouseEnter={swappable ? () => setHoverKey(key) : undefined}
                onMouseLeave={swappable ? () => setHoverKey((k) => (k === key ? null : k)) : undefined}
                onClick={swappable ? () => togglePin(key) : undefined}
              >
                <TeamLogo teamId={badgeTeamId} name={badgeName} size={42} />
              </Badge>
              <span className="careertl__years">{e.yearText}</span>
              {e.tier === 'milb' && e.level && <span className="careertl__level">{e.level}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
