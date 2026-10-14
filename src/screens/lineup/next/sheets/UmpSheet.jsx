import { loadUmpire } from '../../../../api/umpires.js'
import { HomePlateIcon } from '../../../../components/badges/UmpireTierGlyph.jsx'
import { UmpireZoneMap } from '../../../../components/umpire/UmpireZoneMap.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../../../../lib/statTiers.js'
import { SheetFrame } from './SheetFrame.jsx'

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const HAND = { L: 'left-handers', R: 'right-handers' }

function Tile({ label, value, sup }) {
  return (
    <div className="lump__tile">
      <dt>{label}</dt>
      <dd>
        {value}
        {sup && <sub>{sup}</sub>}
      </dd>
    </div>
  )
}

// An umpire's tendencies as a sheet (the redesign of the live Umpire Tendencies card): who he
// is and how many pitches he has called, four figures (accuracy, rank, consistency, run impact),
// where he leans on the zone, the area to watch with its map, and the ABS challenge rates.
// Opened from any crew member's name or the plate umpire's tier note. The same season
// aggregates of finished games' ball and strike calls as the live card, never a run, hit or
// result of any game, so it sits outside any seal. An umpire with no plate record shows his
// name and nothing else.
export function UmpSheet({ id, seasonYear, onClose }) {
  const { data: u } = useAsync(() => loadUmpire(id, { seasonYear }), [id, seasonYear])
  const season = u?.accuracy?.season
  const { lean, watchArea, zoneCells, rank, challenges, leagueChallenges } = u ?? {}
  return (
    <SheetFrame title="Umpire tendencies" label={u?.name ? `Umpire tendencies for ${u.name}` : 'Umpire tendencies'} onClose={onClose}>
      <div className="lump__id">
        <span className="lump__plate" aria-hidden="true">
          <HomePlateIcon size={22} />
        </span>
        <div>
          <small className="lump__role">Home plate</small>
          <strong className="lump__name">{u?.name ?? '…'}</strong>
          {season?.called ? (
            <p className="lump__meta">
              {season.games} scored games · {season.called.toLocaleString()} called pitches
            </p>
          ) : (
            u && <p className="lump__meta">No plate record yet.</p>
          )}
        </div>
      </div>
      {season?.called > 0 && (
        <>
          <dl className="lump__tiles">
            <Tile label="Accuracy" value={pct(season.accuracy)} />
            {rank ? <Tile label="Rank" value={rank.rank} sup={`/${rank.total}`} /> : <Tile label="Called" value={season.called.toLocaleString()} />}
            <Tile label="Consistency" value={pct(season.consistency)} />
            <Tile label="Run impact" value={season.favorPerGame?.toFixed(1) ?? '—'} sup="/gm" />
          </dl>
          {lean && (
            <>
              <h4 className="lsheet__head">Zone lean</h4>
              <div className="lump__lean" role="img" aria-label={`Zone lean: ${LEAN_TIER_LABELS[lean.tier]}`}>
                <span className="lump__caret" style={{ left: `${leanCaretFraction(lean.z) * 100}%` }} />
                <div className="lump__bar">
                  {LEAN_TIERS.map((t) => (
                    <span key={t} className={`lump__seg${t === lean.tier ? ' is-on' : ''}`}>
                      <small>{LEAN_TIER_LABELS[t]}</small>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          {(watchArea || zoneCells) && (
            <>
              <h4 className="lsheet__head">Area to watch</h4>
              <div className="lump__watch">
                <div>
                  <b>{watchArea ? `${watchArea.phrase}${watchArea.hand ? ` to ${HAND[watchArea.hand]}` : ''}` : 'No clear tendency'}</b>
                  <p className="lump__meta">Batter’s view. Outlined where his misses run above the league average.</p>
                </div>
                {zoneCells && <UmpireZoneMap cells={zoneCells} />}
              </div>
            </>
          )}
          {challenges?.perGame != null && (
            <>
              <h4 className="lsheet__head">ABS challenges</h4>
              <dl className="lump__tiles lump__tiles--two">
                <Tile label="Per game" value={challenges.perGame.toFixed(1)} />
                <Tile label="Overturned" value={pct(challenges.overturnRate)} sup="*" />
              </dl>
              {leagueChallenges?.overturnRate != null && <p className="lsheet__foot">*League average: {pct(leagueChallenges.overturnRate)} overturned</p>}
            </>
          )}
          <p className="lsheet__foot">
            {season.games} scored games
            {u.generatedAt && ` · updated ${u.generatedAt.slice(0, 10)}`}
          </p>
        </>
      )}
    </SheetFrame>
  )
}
