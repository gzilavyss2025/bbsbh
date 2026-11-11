import '../../styles/report/streaks.css'
import '../../styles/report/best-stretch.css'
import { useId, useState } from 'react'
import { MEASURES, avg, bestStretch, loadCareerLog, measureByKey, obp, slg } from '../../api/streaks/bestStretch.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { canHit } from '../../lib/scout/roles.js'
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
  return { player: id ? { id, name: q.get('name') ?? '' } : null, n: int(q.get('n'), 10, 500, 162), by: measureByKey(q.get('by')).key }
}
function writeQuery({ player, n, by }) {
  const q = new URLSearchParams({ n, by })
  if (player) { q.set('player', player.id); q.set('name', player.name) }
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`)
}

// One hitter, his best N games in a row (162 by default) by the stat you pick,
// across seasons, from his live MLB game log. Not a scoring surface (ADR-0034).
export function BestStretchPage() {
  useDocumentTitle('Best Stretch')
  const [picks, setPicks] = useState(readQuery)
  const [nDraft, setNDraft] = useState(picks.n)
  const [searching, setSearching] = useState(false)
  const nId = useId()
  const byId = useId()
  const update = (p) => { const next = { ...picks, ...p }; setPicks(next); writeQuery(next) }

  const { loading, error, data: log, reload } = useAsync(
    (signal) => (picks.player ? loadCareerLog(picks.player.id, signal) : Promise.resolve(null)),
    [picks.player?.id],
  )
  const games = log?.games ?? null
  const name = picks.player?.name || log?.name || ''
  const measure = measureByKey(picks.by)
  const best = games ? bestStretch(games, picks.n, measure) : null

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Best Stretch</h1>
      </header>
      <Stack gap="loose">
        <Card frame="stamped" label="Pick a hitter" className="streaks__search">
          <form onSubmit={(e) => { e.preventDefault(); update({ n: int(nDraft, 10, 500, 162) }) }}>
            <Stack gap="snug">
              <Cluster className="streaks__fields">
                <Stack gap="tight" className="streaks__field streaks__field--wide">
                  <span className="t-label">Hitter</span>
                  <Button size="control" onClick={() => setSearching(true)}>{name || 'Search hitters'}</Button>
                </Stack>
                <Stack gap="tight" className="streaks__field">
                  <label className="t-label" htmlFor={byId}>Best by</label>
                  <select id={byId} value={picks.by} onChange={(e) => update({ by: e.target.value })}>
                    {MEASURES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </Stack>
                <Stack gap="tight" className="streaks__field">
                  <label className="t-label" htmlFor={nId}>Games in a row</label>
                  <input id={nId} type="number" inputMode="numeric" min="10" max="500" value={nDraft}
                    onChange={(e) => setNDraft(e.target.value)} onBlur={() => update({ n: int(nDraft, 10, 500, 162) })} />
                </Stack>
              </Cluster>
            </Stack>
          </form>
        </Card>

        {searching && (
          <SiteSearchModal
            onClose={() => setSearching(false)}
            pick={{ label: 'Pick a hitter', placeholder: 'Search hitters', accept: canHit, onPick: (p) => { setSearching(false); update({ player: { id: p.id, name: p.name } }) } }}
          />
        )}

        {!picks.player && <p className="hint">Pick a hitter to find the best {picks.n} games of his career.</p>}

        {picks.player && (
          <AsyncStatus loading={loading} error={error} hasData={!!games} onRetry={reload}
            errorMessage="Couldn’t load his game log. Try again." emptyMessage="No MLB games on file for him." />
        )}

        {games && !loading && !best && (
          <p className="hint">He has {games.length} MLB games on file, fewer than {picks.n}. Try a shorter stretch.</p>
        )}

        {best && !loading && (
          <Card frame="stamped" label={`His best ${picks.n} games`} count={`by ${measure.label}`}>
            <Stack gap="snug" className="stretch">
              <p className="stretch__name"><a href={playerPath(picks.player.id, { name })}>{name}</a></p>
              <p className="t-label">{longDate(best.first)} to {longDate(best.last)}</p>
              <dl className="stretch__grid">
                {[
                  [rate(avg(best)), 'Batting avg'], [rate(obp(best)), 'On-base pct'], [rate(slg(best)), 'Slugging'],
                  [best.homeRuns, 'Home runs'], [best.rbi, 'RBI'], [best.stolenBases, 'Stolen bases'],
                ].map(([v, k]) => <div key={k}><dt className="t-label">{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <ul className="stretch__notes">
                <li>{best.hits} hits and {best.runs} runs</li>
                <li>{rate(obp(best) + slg(best))} OPS</li>
                <li>{best.doubles} 2B · {best.triples} 3B · {best.baseOnBalls} BB · {best.strikeOuts} SO in {best.plateAppearances} PA</li>
                <li>{best.teamIds.map((id) => teamFullName(id)).join(', ')}</li>
              </ul>
              <p className="hint">Regular-season MLB games he appeared in, {best.careerGames} on file. A stretch may run across seasons.</p>
            </Stack>
          </Card>
        )}
      </Stack>
      <ReportFooter />
    </div>
  )
}
