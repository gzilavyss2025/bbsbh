import '../../styles/53-umpire-tendencies.css'
import { humanDate } from '../../lib/dates.js'
import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../../lib/statTiers.js'
import { HomePlateIcon } from '../badges/UmpireTierGlyph.jsx'
import { UmpireZoneMap } from './UmpireZoneMap.jsx'

// The Umpire Tendencies card — a broadcast-style read on how an umpire calls
// the zone, modelled structurally on the in-game TV graphic and rendered in the
// paper-scorebook system. Two hosts, one component: the top of the umpire
// detail page, and UmpireAccuracyModal (which is what a crew member's name
// opens from the lineup page's Umpires card).
//
// THE REGISTER IS LABELS AND NUMBERS. No sentences, no descriptor prose — the
// reference graphic is labels plus one asterisked footnote, and that's the
// target. Anything that needs explaining goes in the aria-label or in
// .scratch/umpire-tendencies/PRD.md, never onto the card.
//
// SPOILER FOOTING: none needed, on the same basis as the accuracy rank already
// shipped on the lineup page (see api/umpires.js). Every figure here is a
// season aggregate over FINAL games of ball/strike JUDGMENTS and their run
// value — never a run, hit, or result. Note umpires.json's game rows do carry
// awayScore/homeScore for the detail page's team-records tally; this card reads
// none of them, and must not start.
//
// MLB only. The AAA aggregate has the same shape and could carry a parallel
// card, but AAA runs the ABS challenge regime differently and ranks against its
// own pool — see api/umpires.js on why the two never blend.

const pct1 = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const runs1 = (x) => (x == null ? '—' : x.toFixed(1))

const HAND_WORD = { L: 'left-handers', R: 'right-handers' }

// The scale's five bands, poles first, with the umpire's own band boxed and the
// caret dropped at his true position inside it. The ramp beside them runs navy
// (pitcher) to kraft amber (hitter): the reference's own blue-to-yellow, and
// deliberately NOT the app's green/clay pair, which means good/bad — neither
// end of this scale is good or bad. See PRD §3.
function LeanScale({ lean }) {
  const label = LEAN_TIER_LABELS[lean.tier]
  return (
    <div className="umptend__lean">
      <div className="umptend__leanhd">Zone lean</div>
      <div
        className="umptend__scale"
        role="img"
        aria-label={
          `Zone lean: ${label}. ` +
          `${lean.lean >= 0 ? 'Hands hitters' : 'Hands pitchers'} ` +
          `${Math.abs(lean.lean).toFixed(2)} net runs per game, ` +
          `${Math.abs(lean.z).toFixed(1)} standard deviations ` +
          `${lean.z >= 0 ? 'above' : 'below'} a league average of ` +
          `${lean.leagueMean >= 0 ? 'plus' : 'minus'} ${Math.abs(lean.leagueMean).toFixed(2)} ` +
          `runs per game to hitters. Five bands, very pitcher friendly to very hitter friendly.`
        }
      >
        <div className="umptend__gutter">
          <span className="umptend__ramp" />
          <span className="umptend__caret" style={{ top: `${leanCaretFraction(lean.z) * 100}%` }} />
        </div>
        <div className="umptend__rows">
          {LEAN_TIERS.map((t) => (
            <div key={t} className={`umptend__row${t === lean.tier ? ' umptend__row--on' : ''}`}>
              <span className="umptend__rowl">{LEAN_TIER_LABELS[t]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The one concrete "where", on the card's second ink anchor, with the zone map
// beside it. Both are computed from the SAME league-relative 3x3 grid — see
// umpireWatchArea in api/umpires.js for the bug that forced it: the older flat
// tally could name a region the map beside it contradicted.
function WatchBand({ watchArea, zoneCells }) {
  if (!watchArea && !zoneCells) return null
  const hand = watchArea?.hand ? ` to ${HAND_WORD[watchArea.hand]}` : ''
  return (
    <div className="umptend__watch">
      <div className="umptend__watchbody">
        <div className="umptend__watchlbl">Area to watch</div>
        {watchArea ? (
          <div className="umptend__watchtxt">
            {watchArea.phrase}
            {hand}
          </div>
        ) : (
          <div className="umptend__watchtxt umptend__watchtxt--none">No clear tendency</div>
        )}
      </div>
      {zoneCells && (
        <div className="umptend__watchmap">
          <UmpireZoneMap cells={zoneCells} />
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, sup }) {
  return (
    <div className="umptend__tile">
      <span className="umptend__tilel">{label}</span>
      <span className="umptend__tilev">
        {value}
        {sup && <sup className="umptend__tilesup">{sup}</sup>}
      </span>
    </div>
  )
}

export function UmpireTendencies({ umpire }) {
  const season = umpire?.accuracy?.season
  // Same guard PlateAccuracyCard uses: an umpire with no plate-accuracy record
  // (MiLB, or the nightly sweep hasn't reached him) gets no card at all rather
  // than an empty shell.
  if (!season?.called) return null

  const games = umpire.games ?? []
  const hpCount = games.filter((g) => g.role === 'HP').length
  const { lean, watchArea, zoneCells, rank, challenges, leagueChallenges } = umpire

  // The identity line stands in for the reference graphic's "5 years of service
  // time", which statsapi simply does not carry — no debut, no tenure, no crew,
  // and no umpire endpoint at all. See PRD §2 Band 2 before trying to add it.
  const [first, ...rest] = (umpire.name ?? '').split(' ')
  const last = rest.join(' ')

  return (
    <section className="umptend">
      <div className="metricbar umptend__bar">
        <h2 className="metricbar__title">Umpire tendencies</h2>
        {umpire.season && <span className="metricbar__aside umptend__season">{umpire.season}</span>}
      </div>

      <div className="umptend__id">
        <span className="umptend__mark" aria-hidden="true">
          <HomePlateIcon />
        </span>
        <div className="umptend__who">
          {last && <div className="umptend__first">{first}</div>}
          <div className="umptend__last">{last || first}</div>
          <div className="umptend__sub">
            {games.length} {games.length === 1 ? 'game' : 'games'}
            {hpCount > 0 && ` · ${hpCount} behind the plate`}
          </div>
        </div>
      </div>

      {lean && <LeanScale lean={lean} />}

      <WatchBand watchArea={watchArea} zoneCells={zoneCells} />

      <div className="umptend__tiles">
        <Tile label="Accuracy" value={pct1(season.accuracy)} />
        {rank ? (
          <Tile label="Rank" value={rank.rank} sup={`/${rank.total}`} />
        ) : (
          <Tile label="Called pitches" value={season.called.toLocaleString()} />
        )}
        <Tile label="Consistency" value={pct1(season.consistency)} />
        <Tile label="Run impact/gm" value={runs1(season.favorPerGame)} />
      </div>

      {challenges?.perGame != null && (
        <div className="umptend__chal">
          <div className="umptend__challbl">ABS challenges</div>
          <div className="umptend__chalrow">
            <Tile label="Per game" value={challenges.perGame.toFixed(1)} />
            <Tile label="Overturned" value={`${pct1(challenges.overturnRate)}*`} />
          </div>
          {leagueChallenges?.overturnRate != null && (
            <p className="umptend__chalfoot">
              *League average: {pct1(leagueChallenges.overturnRate)} overturned
            </p>
          )}
        </div>
      )}

      {/* The run stamp the shard carries (gen-umpires.mjs writes generatedAt),
          not the words "updated nightly". The cadence claim was true of the
          cron's schedule and said nothing about THIS file: on a night the cron
          fails — or, as on 2026-08-28, never gets dispatched at all — the line
          went on promising freshness it had no way to check. A date can be
          read and disbelieved; a claim cannot. */}
      <div className="umptend__prov">
        {umpire.season && `${umpire.season} season · `}
        {season.games} scored {season.games === 1 ? 'game' : 'games'}
        {umpire.generatedAt && ` · updated ${humanDate(umpire.generatedAt.slice(0, 10))}`}
      </div>
    </section>
  )
}
