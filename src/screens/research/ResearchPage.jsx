import '../../styles/report/research.css'
import { useMemo, useRef, useState } from 'react'
import { ASKS, FILTER_BY_KEY, buildQuery, clubName, parseQuery, searchKey } from '../../api/research/filters.js'
import { HISTORY_LAST } from '../../api/research/history.js'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from '../../../scripts/lib/open-data/credits.mjs'
import { isRealDate } from '../../lib/dates.js'
import { labelDate } from '../../lib/time/standingsDates.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { WIDE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { AnswerCard, AskTables, MatchList } from './AnswerView.jsx'
import { FilterBar } from './FilterBar.jsx'
import { useResearch } from './useResearch.js'
import { useEraClubNames } from './useEraClubNames.js'

// RESEARCH (/research, #2234): ask a question of past plays. The page reads ANSWER
// FIRST (Gary, 2026-11-13, wireframe "/research, answer first"): the question, then
// the answer, then one filter bar, then the matches. On a phone the bar's Edit opens
// the filters in a sheet; at the wide step they sit in a left column.
// The query lives in the URL (filters.js), so an answer can be shared. An open page
// (ADR-0034): the store holds only games before the day it was built, and `?d=`
// holds out that day and later. No SealBox.

// THE BLANK STATE (Gary, 2026-11-13, mockup "/research, blank state" v2): a fixed set of
// presets grouped under the four questions, so a first visit learns the four modes by
// reading. No teaser answers and no rotation (his calls). Each row is a whole-row door.
// `wideOnly` presets show at the wide step only (six there, five on a phone). Each was
// run against the 2026 store on 2026-11-13 and returns at least one match.
const PRESETS = [
  { ask: 'last', label: 'Oppo homer, lefty v lefty sinker, inner third', search: '?res=home_run&fld=oppo&pt=SI&loc=inner&bh=L&ph=L' },
  { ask: 'last', label: 'A triple play', search: '?res=triple_play' },
  { ask: 'often', label: 'Lefty homers off lefties', search: '?ask=often&res=home_run&bh=L&ph=L' },
  { ask: 'often', label: 'Hits with RISP, 9th or later', search: '?ask=often&inn=9.x&run=-2-.--3.12-.1-3.-23.123&res=single.double.triple.home_run', wideOnly: true },
  { ask: 'most', label: 'Homers after an 0-2 count', search: '?ask=most&cnt=0-2&res=home_run' },
  { ask: 'what', label: 'After a 3-0 count', search: '?ask=what&cnt=3-0' },
]

// Retrosheet's required notice and the Chadwick register's (the MLBAM ids), shown whenever
// a history season is searched. Written once, in credits.mjs (ADR-0100).
const spanOf = (seasons) => {
  const lo = Math.min(...seasons)
  const hi = Math.max(...seasons)
  return lo === hi ? `${lo}` : `${lo}–${hi}`
}

function readUrl() {
  const d = new URLSearchParams(window.location.search).get('d')
  return { q: parseQuery(window.location.search), cutoff: isRealDate(d) ? d : null }
}

// The filter bar's pills: one per active filter, in words.
function pillsOf(q, people, clubName) {
  const HANDS = { bh: { L: 'LHB', R: 'RHB' }, ph: { L: 'vs LHP', R: 'vs RHP' } }
  const out = Object.entries(q.chips).filter(([, c]) => c.vals.length).map(([k, c]) => {
    const labels = HANDS[k] ?? Object.fromEntries(FILTER_BY_KEY[k].options)
    return `${c.inv ? 'Not ' : ''}${c.vals.map((v) => labels[v]).join(' / ')}`
  })
  if (q.batter) out.push(people[q.batter] ?? 'Batter')
  if (q.pitcher) out.push(`vs ${people[q.pitcher] ?? 'pitcher'}`)
  if (q.team) out.push(`${clubName(q.team)} batting`)
  if (q.pitchTeam) out.push(`${clubName(q.pitchTeam)} pitching`)
  if (q.park) out.push(`at ${clubName(q.park)}`)
  if (q.years) out.push(q.years[0] === q.years[1] ? `${q.years[0]}` : `${q.years[0]}–${q.years[1]}`)
  return out
}

export function ResearchPage() {
  useDocumentTitle('Research')
  const wide = useMediaQuery(WIDE_QUERY)
  const sheet = useRef(null)
  const [{ q, cutoff }, setState] = useState(readUrl)
  const setQ = (next) => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${buildQuery(next, { d: cutoff })}`)
    setState({ q: next, cutoff })
  }
  const { error, head, onFile, targets, blocked, live, blank, run, stop, cover, latest } = useResearch(q, cutoff)
  // A card a season predates is always named; one waiting on a store rebuild only if picked.
  const shownBlocked = blocked.filter((b) => b.since || q.chips[b.key])
  const data = head
  const people = run?.people ?? head?.people ?? {}
  const clubs = useMemo(() => (head ? [...new Set(head.pas.filter((p) => p.gameType !== 'A').map((p) => p.home))].sort((a, b) => clubName(a).localeCompare(clubName(b))) : []), [head])
  // `blank`: nothing filters, so there is no answer. `start`: not even an empty card is
  // open, so the page shows the start screen (presets). An emptied card keeps the page
  // out of the start screen until its ✕ (Gary, 2026-11-13), so on a phone the filter bar
  // stays one tap away. A Seasons range counts as a card.
  const start = blank && !Object.keys(q.chips).length && !q.years
  const result = run?.result ?? null
  const progress = run?.progress
  const eraName = useEraClubNames([q.team, q.pitchTeam, q.park], targets.length ? Math.min(...targets) : null, targets.length ? Math.max(...targets) : null)
  const pills = data ? pillsOf(live, people, eraName) : []
  const bar = data && <FilterBar q={q} people={people} clubs={clubs} seasons={onFile} latest={latest} blocked={blocked} onChange={setQ} />

  const main = (
    <Stack>
      {!start && <Segmented label="Question" fill options={ASKS.map((x) => ({ value: x.key, label: x.label }))} value={q.ask} onChange={(ask) => setQ({ ...q, ask })} />}
      {error && <Notice tone="error">The research store did not load. Try again later.</Notice>}
      {data && cover && (
        <p className="t-label t-label--nocaps">
          {start ? 'Ask about ' : ''}
          {cover.first === cover.last ? cover.first : `${cover.first}–${cover.last}`}
          {start ? `’s ${cover.pitches.toLocaleString()} pitches` : ' MLB'} · through {labelDate(cover.through)}
          {run?.stopped ? ' · stopped' : ''}
          {cutoff ? ` · before ${labelDate(cutoff)}` : ''} · {cover.history ? (cover.last > HISTORY_LAST ? 'Retrosheet and Baseball Savant' : 'Retrosheet') : 'Baseball Savant'}
          {shownBlocked.length > 0 && ` · not in this range: ${shownBlocked.map((b) => `${b.label} (${b.since ? `from ${b.since}` : 'not built yet'})`).join(', ')}`}
          {live.chips.cnt?.vals.length > 0 && cover.thinCounts.length > 0 && ` · pitch-by-pitch counts are missing for most plate appearances in ${spanOf(cover.thinCounts)}`}
        </p>
      )}
      {data && cover?.history && <p className="t-label t-label--nocaps">{RETROSHEET_CREDIT} {CHADWICK_JOIN}</p>}
      {!data && !error && <p className="t-label t-label--nocaps">Loading plays…</p>}
      {data && !targets.length && <p className="t-label t-label--nocaps">No season on file in this range{cutoff ? ` before ${labelDate(cutoff)}` : ''}.</p>}
      {progress && (
        <Cluster>
          <p className="t-label t-label--nocaps" role="status">
            Searching {progress.season}{progress.of > 1 ? ` · season ${progress.n} of ${progress.of}` : ''}…
          </p>
          {progress.of > 1 && <Button size="control" onClick={stop}>Stop</Button>}
        </Cluster>
      )}
      {start && (
        <Card frame="stamped" label="Try one">
          <div className="research__try">
            {ASKS.map((x) => {
              const rows = PRESETS.filter((p) => p.ask === x.key && (wide || !p.wideOnly))
              return (
                <Stack key={x.key} gap="tight" className="research__trygroup">
                  <span className="t-label t-label--bold">{x.label}</span>
                  {rows.map((p) => <Door key={p.search} layout="block" className="research__preset" onClick={() => setQ(parseQuery(p.search))}>{p.label}</Door>)}
                </Stack>
              )
            })}
          </div>
          {data && !wide && <Door layout="block" className="research__own" onClick={() => sheet.current?.showModal()}>Build your own</Door>}
          {data && wide && <p className="research__own t-label">Build your own: start with a filter on the left</p>}
        </Card>
      )}
      {result && <AnswerCard ask={q.ask} q={q} a={result} people={people} />}
      {data && !wide && !start && (
        <Cluster className="research__bar">
          <span className="t-label t-label--bold">Filters · {pills.length}</span>
          {pills.map((p, i) => <Pill key={i}>{p}</Pill>)}
          <Button size="control" className="research__edit" onClick={() => sheet.current?.showModal()}>Edit</Button>
        </Cluster>
      )}
      {result && <AskTables ask={q.ask} q={q} a={result} people={people} onChange={setQ} />}
      {result && <MatchList key={searchKey(q)} a={result} people={people} wide={wide} />}
    </Stack>
  )

  return (
    <div className="screen research">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Research</h1>
      </header>
      {wide && data ? (
        <div className="research__cols">
          <aside className="research__rail">{bar}</aside>
          {main}
        </div>
      ) : main}
      {!wide && data && (
        <dialog ref={sheet} className="research__sheet" aria-label="Filters" onClick={(e) => e.target === sheet.current && sheet.current.close()}>
          <Stack className="research__sheetbody">
            <Cluster className="research__sheethead">
              <span className="t-label t-label--bold">Filters</span>
              <IconButton label="Close filters" onClick={() => sheet.current.close()}>✕</IconButton>
            </Cluster>
            {bar}
            <Button size="tap" skin="ink" onClick={() => sheet.current.close()}>
              {result ? `Show ${result.matches.length.toLocaleString()} ${result.matches.length === 1 ? 'match' : 'matches'}` : 'Done'}
            </Button>
          </Stack>
        </dialog>
      )}
    </div>
  )
}
