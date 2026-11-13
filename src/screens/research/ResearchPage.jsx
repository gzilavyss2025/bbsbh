import '../../styles/report/research.css'
import { useMemo, useState } from 'react'
import { ASKS, buildQuery, parseQuery, unsupported } from '../../api/research/filters.js'
import { answer } from '../../api/research/answer.js'
import { coverage, fetchIndex, fetchStore } from '../../api/research/store.js'
import { isRealDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { AnswerView } from './AnswerView.jsx'
import { FilterBar } from './FilterBar.jsx'

// RESEARCH (/research, #2234): ask a question of past plays. Pick a question, narrow
// it with filter chips, read the answer. The query lives in the URL (filters.js), so
// an answer can be shared. An open page (ADR-0034): the store holds only games before
// the day it was built, and `?d=` holds out that day and later. No SealBox.
//
// FIRST SLICE: the 2026 season, Savant's pitch-level data, read from Vercel Blob.
// Presets, film, RE24 and the Retrosheet history store are later slices.

const PRESETS = [
  { label: 'Oppo homer off a lefty’s sinker, inner third', search: '?res=home_run&fld=oppo&pt=SI&loc=inner&bh=L&ph=L' },
  { label: 'Hits with RISP, 9th or later', search: '?ask=often&inn=9.x&run=risp.loaded&res=single.double.triple.home_run' },
  { label: 'Who homers most after 0-2?', search: '?ask=most&cnt=0-2&res=home_run' },
  { label: 'What happens on 3-0?', search: '?ask=what&cnt=3-0' },
]

function readUrl() {
  const d = new URLSearchParams(window.location.search).get('d')
  return { q: parseQuery(window.location.search), cutoff: isRealDate(d) ? d : null }
}

export function ResearchPage() {
  useDocumentTitle('Research')
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
  const blocked = data?.cover.first ? unsupported(data.cover.first) : []
  const result = useMemo(() => (data ? answer(data.pas, q, cutoff) : null), [data, q, cutoff])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Research</h1>
      </header>
      <Stack>
        <Chips label="Question" layout="wrap" options={ASKS.map((x) => ({ value: x.key, label: x.label }))} value={q.ask} onChange={(ask) => setQ({ ...q, ask })} />
        <Chips label="Presets" layout="wrap" options={PRESETS.map((p) => ({ value: p.search, label: p.label }))} value={null} onChange={(search) => setQ(parseQuery(search))} />
        {store.error && <Notice tone="error">The research store did not load. Try again later.</Notice>}
        {!data && !store.error && <p className="t-label t-label--nocaps">Loading plays{progress ? ` · month ${progress.n} of ${progress.of}` : ''}…</p>}
        {data && (
          <>
            <FilterBar q={q} people={data.people} clubs={clubs} blocked={blocked} onChange={setQ} />
            <p className="t-label t-label--nocaps">
              {data.cover.first === data.cover.last ? data.cover.first : `${data.cover.first}–${data.cover.last}`} MLB, regular season and postseason, through {data.cover.through}
              {cutoff ? `, before ${cutoff}` : ''}. Source: Baseball Savant.
              {blocked.length > 0 && ` Not in this range: ${blocked.map((b) => `${b.label} (from ${b.since})`).join(', ')}.`}
              {' '}Inner third: the third of the plate nearest the batter. Opp field: more than 15° from center toward the opposite side.
            </p>
            <AnswerView key={JSON.stringify(q)} ask={q.ask} a={result} people={data.people} />
          </>
        )}
      </Stack>
    </div>
  )
}
