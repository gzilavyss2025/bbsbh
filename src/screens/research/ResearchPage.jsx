import '../../styles/report/research.css'
import { useMemo, useRef, useState } from 'react'
import { ASKS, FILTER_BY_KEY, buildQuery, clubName, parseQuery, searchKey } from '../../api/research/filters.js'
import { isRealDate } from '../../lib/dates.js'
import { ALL_MLB_TEAM_IDS, teamClubName } from '../../lib/teams.js'
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
import { AskBar } from './AskBar.jsx'
import { parseAsk } from '../../api/research/ask.js'
import { GAME_CHIPS, TOTALS, HOW, rangeWords } from '../../api/research/games.js'
import { GameAnswerCard, GameMatches } from './GameAnswer.jsx'
import { totalLabel } from './GameCards.jsx'
import { STREAK_CHIPS } from '../../api/research/streaks.js'
import { StreakAnswerCard, StreakMatches, streakPills } from './StreakView.jsx'

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

function readUrl() {
  const d = new URLSearchParams(window.location.search).get('d')
  return { q: parseQuery(window.location.search), cutoff: isRealDate(d) ? d : null }
}

const SEARCH_MODES = [{ value: 'play', label: 'Plays' }, { value: 'game', label: 'Games' }, { value: 'streak', label: 'Streaks' }]
const SIDES = [{ value: 'bat', label: 'Batters' }, { value: 'pit', label: 'Pitchers' }]
const NO_STREAK = { side: 'bat', totals: {}, starts: false }
// The Streaks start screen (#3142): three presets, each a whole-row door.
const STREAK_PRESETS = [
  { label: 'Hitting streak', search: '?mode=streak&sh=1-' },
  { label: '10+ strikeout starts', search: '?mode=streak&side=pit&st=1&sso=10-' },
  { label: 'Scoreless starts', search: '?mode=streak&side=pit&st=1&sruns=-0' },
]
const HOW_LABEL = Object.fromEntries(HOW.map(([k, label]) => [k, label]))

// Switch between plays and games (#3137). Game mode has no "What happens".
// Streaks (#3142) keep their own cards and have no Question.
const withMode = (q, mode) => ({ ...q, mode, g: mode === 'game' ? q.g ?? { totals: {}, how: [] } : null, s: mode === 'streak' ? q.s ?? NO_STREAK : null, ask: mode === 'game' && q.ask === 'what' ? 'last' : q.ask })
// Switching side clears the stat cards: the two sides' stats differ.
const withSide = (q, side) => ({ ...q, s: { side, totals: {}, starts: false } })

// The filter bar's pills: one per active filter, in words.
function pillsOf(q, people) {
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
  if (q.mode === 'streak') {
    out.splice(0, out.length, ...out.filter((p) => !p.endsWith(' pitching') && !p.startsWith('at ')).map((p) => p.replace(/ batting$/, '')), ...streakPills(q))
  }
  if (q.mode === 'game') {
    // An emptied range ([null, null]) filters nothing, so it has no pill.
    for (const t of TOTALS) if (q.g.totals[t.key]?.some((v) => v != null)) out.push(`${totalLabel(q, t)} ${rangeWords(q.g.totals[t.key])}`)
    for (const k of q.g.how) out.push(HOW_LABEL[k])
  }
  return out
}

export function ResearchPage() {
  useDocumentTitle('Research')
  const wide = useMediaQuery(WIDE_QUERY)
  const sheet = useRef(null)
  const [{ q, cutoff }, setState] = useState(readUrl)
  // The ask bar's last question (#3138): page state, not the URL. A change made any other
  // way (a chip, a preset) drops it, so the sentence never describes a query it did not make.
  const [asked, setAsked] = useState(null)
  const setQ = (next, fromAsk = null) => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${buildQuery(next, { d: cutoff })}`)
    setState({ q: next, cutoff })
    setAsked(fromAsk)
  }
  const { error, head, onFile, targets, blocked, live, blank, run, stop, cover, latest } = useResearch(q, cutoff)
  // A card a season predates is always named; one waiting on a store rebuild only if picked.
  const game = q.mode === 'game'
  const streak = q.mode === 'streak'
  const shownBlocked = blocked.filter((b) => (b.since || q.chips[b.key]) && (streak ? STREAK_CHIPS.includes(b.key) : !game || GAME_CHIPS.includes(b.key)))
  const asks = game ? ASKS.filter((x) => x.key !== 'what') : ASKS
  const data = head
  const people = run?.people ?? head?.people ?? {}
  const clubNames = useMemo(() => ALL_MLB_TEAM_IDS.map((id) => teamClubName(id)), [])
  const clubs = useMemo(() => (head ? [...new Set(head.pas.filter((p) => p.gameType !== 'A').map((p) => p.home))].sort((a, b) => clubName(a).localeCompare(clubName(b))) : []), [head])
  // `blank`: nothing filters, so there is no answer. `start`: not even an empty card is
  // open, so the page shows the start screen (presets). An emptied card keeps the page
  // out of the start screen until its ✕ (Gary, 2026-11-13), so on a phone the filter bar
  // stays one tap away. A Seasons range counts as a card.
  const start = !game && !streak && blank && !Object.keys(q.chips).length && !q.years
  const result = run?.result ?? null
  const progress = run?.progress
  const pills = data ? pillsOf(live, people) : []
  const onAsk = (text) => {
    const r = parseAsk(text, { people, latest: latest ?? undefined })
    const info = { text, skipped: r.skipped, read: r.read }
    if (r.read) setQ(r.q, info)
    else setAsked(info)
  }
  const without = asked?.read && asked.skipped.length ? `Searched without: ${asked.skipped.map((s) => s.text).join(', ')}` : null
  const bar = data && <FilterBar q={q} people={people} clubs={clubs} seasons={onFile} latest={latest} blocked={blocked} onChange={setQ} />

  const main = (
    <Stack>
      {data && <AskBar key={asked ? 'asked' : 'free'} asked={asked} clubs={clubNames} onAsk={onAsk} />}
      <Segmented label="Search" options={SEARCH_MODES} value={q.mode} onChange={(mode) => setQ(withMode(q, mode))} />
      {streak && <Segmented label="Players" options={SIDES} value={q.s.side} onChange={(side) => setQ(withSide(q, side))} />}
      {!start && !streak && <Segmented label="Question" fill options={asks.map((x) => ({ value: x.key, label: x.label }))} value={live.ask} onChange={(ask) => setQ({ ...q, ask })} />}
      {error && <Notice tone="error">The research store did not load. Try again later.</Notice>}
      {data && cover && (
        <p className="t-label t-label--nocaps">
          {start ? 'Ask about ' : ''}
          {cover.first === cover.last ? cover.first : `${cover.first}–${cover.last}`}
          {start ? `’s ${cover.pitches.toLocaleString()} pitches` : ' MLB'} · through {labelDate(cover.through)}
          {run?.stopped ? ' · stopped' : ''}
          {cutoff ? ` · before ${labelDate(cutoff)}` : ''} · Baseball Savant
          {result?.leftOut > 0 && ` · ${result.leftOut.toLocaleString()} ${result.leftOut === 1 ? 'game' : 'games'} left out: runs on file don’t add up`}
          {shownBlocked.length > 0 && ` · not in this range: ${shownBlocked.map((b) => `${b.label} (${b.since ? `from ${b.since}` : 'not built yet'})`).join(', ')}`}
        </p>
      )}
      {!data && !error && <p className="t-label t-label--nocaps">Loading plays…</p>}
      {data && streak && blank && (
        <Card frame="stamped" label="Try one">
          <Stack gap="tight">
            {STREAK_PRESETS.map((p) => <Door key={p.search} layout="block" className="research__preset" onClick={() => setQ(parseQuery(p.search))}>{p.label}</Door>)}
            <p className="t-label t-label--nocaps">Or add a stat to find streaks.</p>
          </Stack>
        </Card>
      )}
      {data && game && blank && <p className="t-label t-label--nocaps">Pick a club or add a total to find games.</p>}
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
      {result && !game && !streak && <AnswerCard ask={q.ask} q={q} a={result} people={people} note={without} />}
      {result && streak && <StreakAnswerCard q={live} a={result} people={people} asOf={cover?.through} />}
      {result && game && <GameAnswerCard ask={live.ask} q={live} a={result} note={without} />}
      {data && !wide && !start && (
        <Cluster className="research__bar">
          <span className="t-label t-label--bold">Filters · {pills.length}</span>
          {pills.map((p, i) => <Pill key={i}>{p}</Pill>)}
          <Button size="control" className="research__edit" onClick={() => sheet.current?.showModal()}>Edit</Button>
        </Cluster>
      )}
      {result && !game && !streak && <AskTables ask={q.ask} q={q} a={result} people={people} onChange={setQ} />}
      {result && !game && !streak && <MatchList key={searchKey(q)} a={result} people={people} wide={wide} />}
      {result && streak && <StreakMatches key={searchKey(q)} q={live} a={result} people={people} wide={wide} asOf={cover?.through} />}
      {result && game && <GameMatches key={searchKey(q)} ask={live.ask} q={live} a={result} wide={wide} since={cover?.first} />}
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
              {result?.matches ? `Show ${result.matches.length.toLocaleString()} ${result.matches.length === 1 ? 'match' : 'matches'}` : 'Done'}
            </Button>
          </Stack>
        </dialog>
      )}
    </div>
  )
}
