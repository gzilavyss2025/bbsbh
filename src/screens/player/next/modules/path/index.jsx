// The Path to the Majors slot (#1894, the contract is in ../../CLAUDE.md). Board: PathToMajors.
// A two-way player gets one card, the hitting one; the pitching instance reports empty.
import { useEffect } from 'react'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamLogoUrl } from '../../../../../lib/teams.js'
import { loadPath } from './pathData.js'
import { pathView } from './pathView.js'
import '../../../../../styles/player-next/both/path.css'

function Tile({ label, games, years, logoId, now, mlb, aria }) {
  return (
    <li className={`pathmod__tile${now ? ' is-now' : ''}`} aria-label={aria}>
      <span className={`pathmod__bar${mlb ? ' pathmod__bar--mlb' : ''}`} />
      {logoId && <img className="pathmod__logo" src={teamLogoUrl(logoId)} alt="" width="26" height="26" />}
      <span className="pathmod__lvl">{label}</span>
      {games != null && <span className="pathmod__g">{games}</span>}
      <span className="pathmod__yr">{years}</span>
    </li>
  )
}

export default function PathModule({ bio, role, asOf, onEmpty, onCount }) {
  const group = role === 'pitching' ? 'pitching' : 'hitting'
  const skip = group === 'pitching' && bio.twoWay
  const { data, loading: busy } = useAsync(() => (skip ? null : loadPath(bio.id, asOf, group)), [bio.id, asOf, group, skip])
  // useAsync keeps the last player's data for one render after the id changes; an error ends the load with no data.
  const mine = data?.bio?.id === bio.id
  const loading = !skip && (busy || Boolean(data && !mine))
  const view = mine ? pathView(data) : null
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(null) // no count tag (Gary, 2026-10-30)
  }, [loading, view, onEmpty, onCount])

  if (!view) return loading ? <div className="pathmod pathmod--wait" aria-busy="true" /> : null
  return (
    <div className="pathmod">
      {view.headline && <p className="pathmod__head">{view.headline}</p>}
      <div className="pathmod__row">
        <div className="pathmod__minors">
          <p className="pathmod__cap">
            Minors · {view.total} G<span className="pathmod__rule" />
          </p>
          <ol className="pathmod__tiles" style={{ '--tiles': view.levels.length }}>
            {view.levels.map((l) => <Tile key={l.label} {...l} />)}
          </ol>
        </div>
        {view.mlb && (
          <div className="pathmod__majors">
            <p className="pathmod__cap">The Majors</p>
            <ol className="pathmod__tiles">
              <Tile mlb label="MLB" years={view.mlb.debut} logoId={view.mlb.logoId} now={view.mlb.now} />
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
