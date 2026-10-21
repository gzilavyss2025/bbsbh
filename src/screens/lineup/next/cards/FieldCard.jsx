import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { DefenseDiamond } from '../../../../components/scoring/DefenseDiamond.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { headerThemeClass, headerThemeStyle } from '../../../../lib/headerTheme.js'
import { DEFENSE_SPOTS } from '../../../../lib/ballpark/layout/defenseWindow.js'
import { parkWindow } from '../../../../lib/ballpark/layout/parkWindow.js'
import { ClubBar } from './ClubBar.jsx'

// The other club's defense, as names on the park the game is played in: surnames only, no
// photos or positions. The park is the real layout for the venue and date; a venue with no
// layout falls back to the plain diamond. Before the lineup posts the spots read "—". The
// band is the defending club's, because it is that club's defense (ADR-0030).
export function FieldCard({ data, theme, masthead }) {
  const { oppDefense, oppPitcher, oppMeta, info, season, closed } = data
  const layout = resolveBallparkLayout({ venueId: info.venueId, venueName: info.venue, gameDate: info.officialDate })
  const by = Object.fromEntries(oppDefense.map((d) => [d.position, d]))
  if (oppPitcher) by.P = { id: oppPitcher.id, last: oppPitcher.last ?? oppPitcher.name.split(' ').pop(), name: oppPitcher.name }
  const win = layout ? parkWindow(layout) : null
  const dh = by.DH
  const posted = oppDefense.length > 0
  return (
    <Card
      frame="stamped"
      body="flush"
      className={`lfld ${headerThemeClass(theme)}`.trim()}
      style={headerThemeStyle(theme, masthead.scale)}
      head={<ClubBar title="Defensive alignment" teamId={oppMeta.id} teamName={oppMeta.teamName} masthead={masthead} season={season} />}
    >
      {!posted && closed ? (
        <p className="roster__notice">The defensive alignment is not in the record for this game.</p>
      ) : layout ? (
        <div className="lfld__field" style={{ aspectRatio: win.aspectRatio }}>
          <BallparkDiagram layout={layout} viewBox={win.viewBox} className="lfld__park" label={`${info.venue} with the defense`} />
          {Object.entries(DEFENSE_SPOTS).map(([pos, xy]) => {
            const { left, top } = win.percent(xy)
            const who = by[pos]
            return (
              <span key={pos} className="lfld__node" style={{ left: `${left}%`, top: `${top}%` }} role="group" aria-label={pos}>
                <span className={`lfld__name${who ? '' : ' lfld__name--tbd'}`}>
                  {who ? who.id ? <PlayerLink id={who.id} name={who.name ?? data.nameOf(who.id)}>{who.last}</PlayerLink> : who.last : '—'}
                </span>
              </span>
            )
          })}
          {dh && (
            <p className="lfld__dh">
              <span>DH</span>
              {dh.last}
            </p>
          )}
          {!posted && <p className="lfld__hint">Alignment sets when the lineup posts.</p>}
        </div>
      ) : (
        <DefenseDiamond defense={oppDefense} />
      )}
    </Card>
  )
}
