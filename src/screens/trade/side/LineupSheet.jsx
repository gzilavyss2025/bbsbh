import { useRef, useState } from 'react'
import { asDepth, lineupAfter } from '../../../lib/trade/lineup.js'
import { teamClubName } from '../../../lib/teams.js'
import { headerThemeFor, themeKeyFor } from '../../../lib/colors/headerTheme.js'
import { useDialogFocus } from '../../../hooks/dialog/useDialogFocus.js'
import { ModalPortal } from '../../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../../components/ui/control/IconButton.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'

// The two clubs' lineups as they would stand after the deal, in a sheet off the
// tray's Lineups button (docs/wireframes/lineup-after-deal.html). It opens on
// what changed; "Show full lineup" lists every spot. A phone shows one club at a
// time behind a switch whose tabs carry each club's lineup WAR. The lineup is
// rough by design (lib/trade/lineup.js): best by last season's WAR.

const DASH = '—'
const signed = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}`

function ClubLineup({ club, other, hidden }) {
  const [full, setFull] = useState(false)
  const view = lineupAfter(club.data.depth, { out: club.sends.map(asDepth), inn: other.sends.map(asDepth) })
  const theme = headerThemeFor(club.teamId, themeKeyFor(club.teamId, 'home', 'main'))
  const rows = full ? view.spots : view.spots.filter((s) => s.changed)
  const partner = teamClubName(other.teamId)
  return (
    <section className={hidden ? 'lineupsheet__club lineupsheet__club--off' : 'lineupsheet__club'}
      style={{ '--club-edge': theme?.bar ?? 'var(--border-stamped)' }} aria-label={`${teamClubName(club.teamId)} after the deal`}>
      <h3 className="lineupsheet__title"><TeamLogo teamId={club.teamId} size={24} />{teamClubName(club.teamId)} after the deal</h3>
      <p className="lineupsheet__head">Lineup WAR <span className="lineupsheet__headfig">{signed(view.after - view.before)}</span></p>
      <table className="lineupsheet__table">
        <thead><tr><th>Spot</th><th>{full ? 'Starter' : 'What changed'}</th><th className="lineupsheet__num">WAR</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.spot} className={s.changed && s.weak ? 'lineupsheet__row lineupsheet__row--weak' : 'lineupsheet__row'}>
              <td className="lineupsheet__spot">{s.spot}</td>
              <td>
                <span className="lineupsheet__name">{s.after?.name ?? 'Nobody'}</span>
                {s.changed && s.after && <span className="lineupsheet__tag">New</span>}
                {s.changed && (
                  <span className="lineupsheet__sub">
                    {s.incoming ? `From ${partner}` : s.weak ? 'Best left' : null}
                    {s.before && !s.incoming ? `${s.weak ? ' · ' : ''}Was ${s.before.name}` : null}
                  </span>
                )}
              </td>
              <td className="lineupsheet__num lineupsheet__war">{s.after?.war != null ? `${s.after.war < 0 ? '−' : ''}${Math.abs(s.after.war).toFixed(1)}` : DASH}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="lineupsheet__none">No lineup spot changes hands.</td></tr>}
        </tbody>
      </table>
      <Button size="control" skin="ghost" className="lineupsheet__more" onClick={() => setFull(!full)}>
        {full ? 'Show what changed' : `Show full lineup (${view.spots.length} spots)`}
      </Button>
    </section>
  )
}

// The Lineups mark: a ball field's diamond with its bases (not the site menu's three bars).
export function LineupsGlyph() {
  return (
    <svg className="tradeboard__lineupsglyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2 14 8 8 14 2 8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 1h0M15 8h0M8 15h0M1 8h0" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}

// `start`: which club a phone shows first (0 or 1), the one whose card opened it.
export function LineupSheet({ clubs, start = 0, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const [which, setWhich] = useState(start)
  const ready = clubs.every((c) => c.data?.depth)
  const totals = ready ? clubs.map((c, i) => {
    const v = lineupAfter(c.data.depth, { out: c.sends.map(asDepth), inn: clubs[1 - i].sends.map(asDepth) })
    return v.after - v.before
  }) : []
  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet lineupsheet" role="dialog" aria-modal="true" aria-label="Lineups after the deal">
          <div className="tradesheet__head">
            <h2 className="sheet__title">Lineups after the deal</h2>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>
          {!ready ? <p className="hint" role="status">Reading the two rosters…</p> : (
            <>
              {/* A phone shows one club at a time; each tab carries its lineup WAR. */}
              <div className="lineupsheet__switch" role="group" aria-label="Which club">
                {clubs.map((c, i) => (
                  <button key={c.teamId} type="button" className="lineupsheet__tab" aria-pressed={which === i} onClick={() => setWhich(i)}>
                    <span>{teamClubName(c.teamId)}</span>
                    <span className="lineupsheet__tabfig">{signed(totals[i])} WAR</span>
                  </button>
                ))}
              </div>
              <div className="lineupsheet__clubs">
                {clubs.map((c, i) => <ClubLineup key={c.teamId} club={c} other={clubs[1 - i]} hidden={which !== i} />)}
              </div>
              <p className="lineupsheet__fine">
                A rough lineup: the best player at each spot by last season’s WAR among big leaguers and Triple-A, the best bat left at DH, and the five best arms as the rotation. Under 1.0 WAR is highlighted.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
