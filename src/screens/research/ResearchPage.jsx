import '../../styles/report/research.css'
import { useMemo, useRef, useState } from 'react'
import { ASKS, FILTER_BY_KEY, buildQuery, isBlank, parseQuery, unsupported } from '../../api/research/filters.js'
import { answer } from '../../api/research/answer.js'
import { coverage, fetchIndex, fetchStore } from '../../api/research/store.js'
import { isRealDate } from '../../lib/dates.js'
import { labelDate } from '../../lib/time/standingsDates.js'
import { useAsync } from '../../hooks/useAsync.js'
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
  { ask: 'often', label: 'Hits with RISP, 9th or later', search: '?ask=often&inn=9.x&run=risp.loaded&res=single.double.triple.home_run', wideOnly: true },
  { ask: 'most', label: 'Homers after an 0-2 count', search: '?ask=most&cnt=0-2&res=home_run' },
  { ask: 'what', label: 'After a 3-0 count', search: '?ask=what&cnt=3-0' },
]

function readUrl() {
  const d = new URLSearchParams(window.location.search).get('d')
  return { q: parseQuery(window.location.search), cutoff: isRealDate(d) ? d : null }
}

// The filter bar's pills: one per active filter, in words.
function pillsOf(q, people) {
  const HANDS = { bh: { L: 'LHB', R: 'RHB' }, ph: { L: 'vs LHP', R: 'vs RHP' } }
  const out = Object.entries(q.chips).filter(([, c]) => c.vals.length).map(([k, c]) => {
    const labels = HANDS[k] ?? Object.fromEntries(FILTER_BY_KEY[k].options)
    return `${c.inv ? 'Not ' : ''}${c.vals.map((v) => labels[v]).join(' / ')}`
  })
  if (q.batter) out.push(people[q.batter] ?? 'Batter')
  if (q.pitcher) out.push(`vs ${people[q.pitcher] ?? 'pitcher'}`)
  if (q.team) out.push(`${q.team} batting`)
  if (q.park) out.push(`at ${q.park}`)
  return out
}

export function ResearchPage() {
  useDocumentTitle('Research')
  const wide = useMediaQuery(WIDE_QUERY)
  const sheet = useRef(null)
  const [{ q, cutoff }, setState] = useState(readUrl)
  const [progress, setProgress] = useState(null)
  const setQ = (next) => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${buildQuery(next, { d: cutoff })}`)
    setState({ q: next, cutoff })
  }
  const store = useAsync(async () => {
    const index = await fetchIndex()
    const data = await fetchStore(index, (n, of) => setProgress({ n, of }))
    return { ...data, cover: coverage(index) }
  }, [])
  const data = store.data
  const clubs = useMemo(() => (data ? [...new Set(data.pas.map((p) => p.home))].sort() : []), [data])
  const blocked = useMemo(() => (data?.cover.first ? unsupported(data.cover.first) : []), [data])
  // A chip the store's seasons cannot answer stays in the URL but out of the query.
  const live = useMemo(() => {
    const chips = { ...q.chips }
    for (const b of blocked) delete chips[b.key]
    return { ...q, chips }
  }, [q, blocked])
  const blank = isBlank(live)
  const result = useMemo(() => (data && !blank ? answer(data.pas, live, cutoff) : null), [data, live, cutoff, blank])
  const pills = data ? pillsOf(live, data.people) : []
  const bar = data && <FilterBar q={q} people={data.people} clubs={clubs} blocked={blocked} onChange={setQ} />

  const main = (
    <Stack>
      {!blank && <Segmented label="Question" fill options={ASKS.map((x) => ({ value: x.key, label: x.label }))} value={q.ask} onChange={(ask) => setQ({ ...q, ask })} />}
      {store.error && <Notice tone="error">The research store did not load. Try again later.</Notice>}
      {data && (
        <p className="t-label t-label--nocaps">
          {blank ? 'Ask about ' : ''}
          {data.cover.first === data.cover.last ? data.cover.first : `${data.cover.first}–${data.cover.last}`}
          {blank ? `’s ${data.cover.pitches.toLocaleString()} pitches` : ' MLB'} · through {labelDate(data.cover.through)}
          {cutoff ? ` · before ${labelDate(cutoff)}` : ''} · Baseball Savant
          {blocked.length > 0 && ` · not in this range: ${blocked.map((b) => `${b.label} (from ${b.since})`).join(', ')}`}
        </p>
      )}
      {!data && !store.error && <p className="t-label t-label--nocaps">Loading plays{progress ? ` · month ${progress.n} of ${progress.of}` : ''}…</p>}
      {blank && (
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
      {result && <AnswerCard ask={q.ask} a={result} people={data.people} />}
      {data && !wide && !blank && (
        <Cluster className="research__bar">
          <span className="t-label t-label--bold">Filters · {pills.length}</span>
          {pills.map((p, i) => <Pill key={i}>{p}</Pill>)}
          <Button size="control" className="research__edit" onClick={() => sheet.current?.showModal()}>Edit</Button>
        </Cluster>
      )}
      {result && <AskTables ask={q.ask} a={result} people={data.people} />}
      {result && <MatchList key={JSON.stringify(q)} a={result} people={data.people} wide={wide} />}
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
