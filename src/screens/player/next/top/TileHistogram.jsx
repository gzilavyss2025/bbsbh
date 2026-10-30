import { fetchLeaguePool, fetchPositionWarPool } from '../../../../api/player/leaguePool.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { ordinal } from '../../../../lib/format.js'

// The hero tiles a histogram can open, by tile key: the statsapi field, whether lower is better, and
// whether the axis runs backwards so best reads right (default: when lower is better). A hitter's
// strikeouts run plain, fewest to most (Gary, 2026-10-30). WAR is a hitter's against his own
// position (fetchPositionWarPool); a pitcher's WAR tile does not open.
// WAR and W–L have no single league field, so their tiles do not open.
const POOL_STATS = {
  hitting: { AVG: ['avg'], HR: ['homeRuns'], RBI: ['rbi'], SO: ['strikeOuts', true, false], OPS: ['ops'], SB: ['stolenBases'], WAR: ['war'] },
  pitching: { ERA: ['era', true], WHIP: ['whip', true], K: ['strikeOuts'], IP: ['inningsPitched'], SV: ['saves'] },
}

// A position's plural, for the WAR ruler's label.
const POSITION_PLURAL = {
  C: 'catchers', '1B': 'first basemen', '2B': 'second basemen', '3B': 'third basemen', SS: 'shortstops',
  LF: 'left fielders', CF: 'center fielders', RF: 'right fielders', OF: 'outfielders', DH: 'designated hitters',
}

export const histogramFor = (group, tileKey) => POOL_STATS[group]?.[tileKey] ?? null

// The tile's figure on one ruler of every qualified player this season: worst at the left, best at
// the right, the track filled up to his figure, his figure a dot and the league figure dashed (Gary,
// 2026-10-30: where he sits, not how many sit where). Nothing drawn when the pool is empty.
export function TileHistogram({ group, tile, season, name, position, closing = false, onClosed }) {
  const [key, lowerBetter, flip = lowerBetter] = histogramFor(group, tile.k)
  const { data: pool } = useAsync(
    () => (key === 'war' ? fetchPositionWarPool(season, position) : fetchLeaguePool(season, group, key)),
    [season, group, key, position],
  )
  const value = Number(tile.v)
  if (!pool?.length || !Number.isFinite(value)) return null
  const lo = Math.min(...pool, value)
  const hi = Math.max(...pool, value)
  const at = (v) => `${((flip ? hi - v : v - lo) / (hi - lo || 1)) * 100}%`
  const better = pool.filter((v) => (lowerBetter ? v > value : v < value)).length
  const rank = pool.length - better
  const among = key === 'war' ? `Among ${POSITION_PLURAL[position] ?? position} with 300+ PA` : null
  const who = among ? (POSITION_PLURAL[position] ?? position) + ' with 300+ PA' : group === 'pitching' ? 'pitchers' : 'qualified hitters'
  const lg = tile.lg != null ? Number(tile.lg) : null
  // The ends in the tile's own format: its decimals, and no leading zero when it has none (.270).
  const places = (String(tile.v).split('.')[1] ?? '').length
  const fmt = (v) => (String(tile.v).startsWith('.') ? v.toFixed(places).replace(/^0\./, '.') : v.toFixed(places))
  const [left, right] = flip ? [hi, lo] : [lo, hi]
  return (
    <div className={`tileruler${closing ? ' is-closing' : ''}`} onAnimationEnd={(e) => closing && e.target === e.currentTarget && onClosed?.()} role="img" aria-label={`${tile.k} ${tile.v}: ${ordinal(rank)} of ${pool.length} ${who}`}>
      {among && <p className="tileruler__among">{among}</p>}
      <div className="tileruler__track">
        <i className="tileruler__fill" style={{ width: at(value) }} />
        {Number.isFinite(lg) && <span className="tileruler__lg" style={{ left: at(lg) }}><small>Lg avg {tile.lg}</small></span>}
        <span className={`tileruler__him${parseFloat(at(value)) > 50 ? ' is-right' : ''}`} style={{ left: at(value) }}><small>{name ? `${name}: ` : ''}{tile.v} {tile.k}{tile.caption ? ` · ${tile.caption}` : ''}</small></span>
      </div>
      <p className="tileruler__axis"><span>{fmt(left)} {tile.k}</span><span>{fmt(right)} {tile.k}</span></p>
    </div>
  )
}
