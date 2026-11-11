import '../../styles/report/streaks.css'
import '../../styles/report/best-stretch.css'
import { useId, useState } from 'react'
import { avg, bestStretch, dec2, ip, isStarter, kRate, loadCareerLog, measureByKey, measuresFor, obp, presetsFor, rate3, showsHolds, slg, whip } from '../../api/streaks/bestStretch.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { canHit, canPitch } from '../../lib/scout/roles.js'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { playerPath } from '../../lib/route.js'
import { headerThemeFor, headerThemeStyle } from '../../lib/colors/headerTheme.js'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { SiteSearchModal } from '../../components/chrome/SiteSearch.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

const rate = rate3
const longDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const pct = (v) => `${(v * 100).toFixed(1)}%`
const count = (v) => v.toLocaleString('en-US')
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`
const int = (v, lo, hi, dflt) => {
  const x = Number.parseInt(v, 10)
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt
}

// The 3x2 grid per role: [value, label, "of" denominator].
function tilesFor(role, t) {
  if (role === 'hitter') return [[rate(avg(t)), 'Avg'], [rate(obp(t)), 'OBP'], [rate(slg(t)), 'SLG'], [t.homeRuns, 'Home runs'], [t.rbi, 'RBI'], [t.stolenBases, 'Steals']]
  if (role === 'starter') return [[dec2(whip(t)), 'WHIP'], [t.strikeOuts, 'Strikeouts'], [`${t.wins}–${t.losses}`, 'W–L'], [ip(t), 'Innings'], [t.baseOnBalls, 'Walks'], [t.homeRuns, 'HR allowed']]
  return [
    showsHolds(t) ? [t.holds, 'Holds'] : [t.saves, 'Saves', t.saveOpportunities],
    [dec2(whip(t)), 'WHIP'], [t.strikeOuts, 'Strikeouts'], [pct(kRate(t)), 'K rate'], [ip(t), 'Innings'],
    [t.inheritedRunnersScored, 'Inherited scored', t.inheritedRunners],
  ]
}

// One quiet secondary line under the grid.
function lineFor(role, t) {
  if (role === 'hitter') return `${t.hits} H · ${t.runs} R · ${t.doubles} 2B · ${t.triples} 3B · ${t.baseOnBalls} BB · ${t.strikeOuts} SO · ${t.plateAppearances} PA`
  if (role === 'starter') return [`${(t.outs / 3 / t.games).toFixed(1)} innings per start`, `${t.hits} H`, t.completeGames && plural(t.completeGames, 'complete game'), t.shutouts && plural(t.shutouts, 'shutout')].filter(Boolean).join(' · ')
  return [`${t.hits} H`, `${t.homeRuns} HR`, `${t.baseOnBalls} BB`, plural(t.blownSaves, 'blown save'), `${t.gamesFinished} games finished`, `${t.wins}–${t.losses}`].join(' · ')
}

// The window search, cached per loaded log so a keystroke or a modal toggle does
// not redo it (nor the starts-only filter). Keyed on the log's array, so it is
// dropped with the log.
const searches = new WeakMap()
function cachedSearch(games, startsOnly, n, by, group) {
  if (!games) return { pool: null, best: null }
  let entry = searches.get(games)
  if (!entry) searches.set(games, (entry = { pools: new Map(), bests: new Map() }))
  if (!entry.pools.has(startsOnly)) entry.pools.set(startsOnly, startsOnly ? games.filter((g) => g.gamesStarted > 0) : games)
  const pool = entry.pools.get(startsOnly)
  const key = `${startsOnly}:${n}:${by}:${group}`
  if (!entry.bests.has(key)) entry.bests.set(key, pool.length ? bestStretch(pool, n, measureByKey(by, group), group) : null)
  return { pool, best: entry.bests.get(key) }
}

// The picks ride the query so a link opens the same card.
function readQuery() {
  const q = new URLSearchParams(window.location.search)
  const id = int(q.get('player'), 1, 1e7, null)
  const group = q.get('group') === 'pitching' ? 'pitching' : 'hitting'
  const n = int(q.get('n'), 5, 500, null)
  return { player: id ? { id, name: q.get('name') ?? '' } : null, group, n, by: measureByKey(q.get('by'), group).key }
}
function writeQuery({ player, group, n, by }) {
  const q = new URLSearchParams({ group, by })
  if (n) q.set('n', n)
  if (player) { q.set('player', player.id); q.set('name', player.name) }
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`)
}

// One hitter, his best N games in a row (162 by default) by the stat you pick,
// across seasons, from his live MLB game log. A pitcher counts starts (32) if
// he is mostly a starter, else appearances (65); n=null means that default.
// Not a scoring surface (ADR-0034).
export function BestStretchPage() {
  useDocumentTitle('Best Stretch')
  const [picks, setPicks] = useState(readQuery)
  const [nDraft, setNDraft] = useState(picks.n ?? '')
  const [searching, setSearching] = useState(false)
  const nId = useId()
  const byId = useId()
  const update = (p) => { const next = { ...picks, ...p }; setPicks(next); writeQuery(next) }

  const { loading, error, data: log, reload } = useAsync(
    (signal) => (picks.player ? loadCareerLog(picks.player.id, signal, picks.group) : Promise.resolve(null)),
    [picks.player?.id, picks.group],
  )
  const pitching = picks.group === 'pitching'
  const starter = pitching && log ? isStarter(log.games) : false
  const unit = pitching ? (starter ? 'starts' : 'appearances') : 'games'
  // Before a pitcher's log loads his role is unknown; the chips assume a starter.
  const role = pitching ? (log && !starter ? 'reliever' : 'starter') : 'hitter'
  const presets = presetsFor(role)
  const n = picks.n ?? presets.season
  const [customOpen, setCustomOpen] = useState(false)
  const custom = customOpen || !presets.options.includes(n)
  // The log's own name wins: the query's `name` is only a placeholder until it loads.
  const name = log?.name || picks.player?.name || ''
  const measure = measureByKey(picks.by, picks.group)
  // A starter's window counts starts only; a reliever's counts every outing.
  const { pool: games, best } = cachedSearch(log?.games, starter, n, picks.by, picks.group)
  const setGroup = (group) => { setNDraft(''); setCustomOpen(false); update({ group, n: null, by: measureByKey(null, group).key }) }
  // An emptied box keeps the length in effect rather than snapping to the default.
  const commitN = () => { if (nDraft !== '') update({ n: int(nDraft, 5, 500, picks.n) }) }
  // A preset chip; the season-length one stores no n, so the role's default applies.
  const pickPreset = (v) => { setCustomOpen(false); setNDraft(''); update({ n: v === presets.season ? null : v }) }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Best Stretch</h1>
      </header>
      <Stack gap="loose">
        <Card frame="stamped" label="Pick a player" className="streaks__search">
          <form onSubmit={(e) => { e.preventDefault(); commitN() }}>
            <Stack gap="snug">
              <Cluster className="streaks__fields">
                <Stack gap="tight" className="streaks__field streaks__field--wide">
                  <span className="t-label">Player</span>
                  <button type="button" className="stretch__who" onClick={() => setSearching(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                    <span>{name || (pitching ? 'Search pitchers' : 'Search hitters')}</span>
                  </button>
                </Stack>
                <Stack gap="tight" className="streaks__field streaks__field--wide">
                  <span className="t-label">Side</span>
                  <Segmented label="Batting or pitching" value={picks.group} onChange={setGroup}
                    options={[{ value: 'hitting', label: 'Batting' }, { value: 'pitching', label: 'Pitching' }]} />
                </Stack>
                <Stack gap="tight" className="streaks__field">
                  <label className="t-label" htmlFor={byId}>Best by</label>
                  <select id={byId} value={picks.by} onChange={(e) => update({ by: e.target.value })}>
                    {measuresFor(picks.group).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </Stack>
                <Stack gap="tight" className="streaks__field streaks__field--wide">
                  <span className="t-label" id={nId}>{pitching ? (role === 'reliever' ? 'Appearances in a row' : 'Starts in a row') : 'Games in a row'}</span>
                  <Cluster gap="tight" role="group" aria-labelledby={nId} className="stretch__chips">
                    {presets.options.map((v) => (
                      <Button key={v} size="control" skin={!custom && n === v ? 'ink' : 'outline'} aria-pressed={!custom && n === v} onClick={() => pickPreset(v)}>
                        {v === presets.season ? `${v} · season` : v}
                      </Button>
                    ))}
                    <Button size="control" skin={custom ? 'ink' : 'outline'} aria-pressed={custom} onClick={() => { setCustomOpen(true); setNDraft(String(n)) }}>Custom</Button>
                  </Cluster>
                  {custom && (
                    <span className="streaks__total">
                      <input type="number" inputMode="numeric" min="5" max="500" aria-label={`Custom number of ${unit}`} value={nDraft === '' ? String(n) : nDraft}
                        onChange={(e) => setNDraft(e.target.value)} onBlur={commitN} />
                      <span className="hint">{unit}, 5 to 500</span>
                    </span>
                  )}
                </Stack>
              </Cluster>
            </Stack>
          </form>
        </Card>

        {searching && (
          <SiteSearchModal
            onClose={() => setSearching(false)}
            pick={{ label: pitching ? 'Pick a pitcher' : 'Pick a hitter', placeholder: pitching ? 'Search pitchers' : 'Search hitters', accept: pitching ? canPitch : canHit, onPick: (p) => { setSearching(false); update({ player: { id: p.id, name: p.name } }) } }}
          />
        )}

        {!picks.player && <p className="hint">Pick a {pitching ? 'pitcher' : 'hitter'} to find the best {pitching ? 'starts or relief outings' : `${n} games`} of his career.</p>}

        {picks.player && (
          <AsyncStatus loading={loading} error={error} hasData={!!games?.length} onRetry={reload}
            errorMessage="Couldn’t load his game log. Try again." emptyMessage="No MLB games on file for him." />
        )}

        {games?.length > 0 && !loading && !best && (
          <p className="hint">He has {games.length} MLB {unit} on file, fewer than {n}. Try a shorter stretch.</p>
        )}

        {best && !loading && (
          <Card frame="stamped" body="flush" className="stretch" style={headerThemeStyle(headerThemeFor(best.mainTeamId, 'main'))} aria-label={`${name}, best ${n} ${unit}`}>
            <div className="stretch__band">
              <div className="stretch__shot"><Headshot personId={picks.player.id} name={name} teamId={best.mainTeamId} /></div>
              <Stack gap="tight" className="stretch__who-line">
                <span className="stretch__kicker">His best {n} {unit}</span>
                <a className="stretch__name" href={playerPath(picks.player.id, { name })}>{name}</a>
              </Stack>
              {best.mainTeamId && <span className="stretch__mark"><TeamLogo teamId={best.mainTeamId} name={best.teams[0] ?? ''} size={40} variant="mono" /></span>}
            </div>
            <Stack gap="snug" className="stretch__body">
              <p className="stretch__dates">{longDate(best.first)} → {longDate(best.last)}</p>
              <p className="stretch__hero">
                <span className="stretch__hero-num">{measure.format(measure.of(best))}</span>
                <span className="stretch__hero-label">{measure.label}</span>
                <span className="stretch__ranked">Ranked by</span>
              </p>
              <dl className="stretch__grid">
                {tilesFor(role, best).map(([v, k, of]) => (
                  <div key={k}><dt className="t-label">{k}</dt><dd>{v}{of != null && <span className="stretch__of"> of {of}</span>}</dd></div>
                ))}
              </dl>
              <p className="stretch__line">{lineFor(role, best)}</p>
              <p className="hint">{best.teams.join(', ')} · regular season · {count(best.careerGames)} career {unit} on file</p>
            </Stack>
          </Card>
        )}
      </Stack>
      <ReportFooter />
    </div>
  )
}
