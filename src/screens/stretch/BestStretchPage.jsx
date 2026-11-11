import '../../styles/report/streaks.css'
import '../../styles/report/best-stretch.css'
import { useId, useState } from 'react'
import { avg, bestStretch, era, ip, isStarter, loadCareerLog, measureByKey, measuresFor, obp, slg, whip } from '../../api/streaks/bestStretch.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { canHit, canPitch } from '../../lib/scout/roles.js'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { teamFullName } from '../../lib/teams.js'
import { playerPath } from '../../lib/route.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { SiteSearchModal } from '../../components/chrome/SiteSearch.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

const rate = (v) => v.toFixed(3).replace(/^0/, '')
const longDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const int = (v, lo, hi, dflt) => {
  const x = Number.parseInt(v, 10)
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt
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
  // A starter's window counts starts only; a reliever's counts every outing.
  const games = log ? (starter ? log.games.filter((g) => g.gamesStarted > 0) : log.games) : null
  const unit = pitching ? (starter ? 'starts' : 'appearances') : 'games'
  const n = picks.n ?? (pitching ? (starter ? 32 : 65) : 162)
  const name = picks.player?.name || log?.name || ''
  const measure = measureByKey(picks.by, picks.group)
  const best = games ? bestStretch(games, n, measure, picks.group) : null
  const setGroup = (group) => { setNDraft(''); update({ group, n: null, by: measureByKey(null, group).key }) }
  const commitN = () => update({ n: nDraft === '' ? null : int(nDraft, 5, 500, null) })

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
                  <Button size="control" onClick={() => setSearching(true)}>{name || (pitching ? 'Search pitchers' : 'Search hitters')}</Button>
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
                <Stack gap="tight" className="streaks__field">
                  <label className="t-label" htmlFor={nId}>{pitching ? 'Outings in a row' : 'Games in a row'}</label>
                  <input id={nId} type="number" inputMode="numeric" min="5" max="500" value={nDraft} placeholder={String(n)}
                    onChange={(e) => setNDraft(e.target.value)} onBlur={commitN} />
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
          <AsyncStatus loading={loading} error={error} hasData={!!games} onRetry={reload}
            errorMessage="Couldn’t load his game log. Try again." emptyMessage="No MLB games on file for him." />
        )}

        {games && !loading && !best && (
          <p className="hint">He has {games.length} MLB {unit} on file, fewer than {n}. Try a shorter stretch.</p>
        )}

        {best && !loading && (
          <Card frame="stamped" label={`His best ${n} ${unit}`} count={`by ${measure.label}`}>
            <Stack gap="snug" className="stretch">
              <p className="stretch__name"><a href={playerPath(picks.player.id, { name })}>{name}</a></p>
              <p className="t-label">{longDate(best.first)} to {longDate(best.last)}</p>
              <dl className="stretch__grid">
                {(pitching
                  ? [[era(best).toFixed(2), 'ERA'], [whip(best).toFixed(2), 'WHIP'], [best.strikeOuts, 'Strikeouts'],
                      [`${best.wins}–${best.losses}`, 'W–L'], [ip(best), 'Innings'], [best.baseOnBalls, 'Walks']]
                  : [[rate(avg(best)), 'Batting avg'], [rate(obp(best)), 'On-base pct'], [rate(slg(best)), 'Slugging'],
                      [best.homeRuns, 'Home runs'], [best.rbi, 'RBI'], [best.stolenBases, 'Stolen bases']]
                ).map(([v, k]) => <div key={k}><dt className="t-label">{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <ul className="stretch__notes">
                {pitching ? (
                  <>
                    <li>{best.hits} hits and {best.homeRuns} home runs allowed</li>
                    {(best.completeGames > 0 || best.shutouts > 0) && <li>{best.completeGames} complete games, {best.shutouts} shutouts</li>}
                    {best.saves > 0 && <li>{best.saves} saves</li>}
                  </>
                ) : (
                  <>
                    <li>{best.hits} hits and {best.runs} runs</li>
                    <li>{rate(obp(best) + slg(best))} OPS</li>
                    <li>{best.doubles} 2B · {best.triples} 3B · {best.baseOnBalls} BB · {best.strikeOuts} SO in {best.plateAppearances} PA</li>
                  </>
                )}
                <li>{best.teamIds.map((id) => teamFullName(id)).join(', ')}</li>
              </ul>
              <p className="hint">Regular-season MLB {unit}{pitching ? '' : ' he appeared in'}, {best.careerGames} on file. A stretch may run across seasons.</p>
            </Stack>
          </Card>
        )}
      </Stack>
      <ReportFooter />
    </div>
  )
}
