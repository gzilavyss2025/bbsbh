import { useEffect, useMemo, useRef, useState } from 'react'
import { answer, summarize } from '../../api/research/answer.js'
import { isBlank, matcher, mayMatch, searchKey, seasonsFor, unsupported } from '../../api/research/filters.js'
import { HISTORY_LAST } from '../../api/research/history.js'
import { GAME_CHIPS, answerGames, isGameBlank, summarizeGames } from '../../api/research/games.js'
import { attachSeries, coverage, dropSeason, dropSeasonsExcept, fetchIndex, loadSeason, seasonEvents, seasonsOnFile, storeVersion } from '../../api/research/store.js'

// The first season game mode's Pitches total answers in (#3163).
const PITCHES_SINCE = 1988

// THE SEARCH behind /research (#2234, scope #2): which seasons a query reads, loading them,
// and the answer. filters.js seasonsFor picks the seasons. Two shapes:
//   ONE PASS. A Seasons range, or "How often" / "Who most" / "What happens" (latest season):
//     every season loads, then one answer over all of them.
//   SEASON BY SEASON. "Last time" with no range, or with one that reaches the history
//     seasons (#3150: up to 54 seasons will not fit a phone at once; a one-pass question
//     keeps only each history season's base PAs): newest season first, an answer after each,
//     until the oldest or Stop. A season whose index counts say it holds none of a picked
//     result is skipped unfetched (mayMatch). Each season is freed once read, the latest
//     excepted [DECISION: free every searched season, not only the ones with no match;
//     a homer search matches in all twelve, and twelve decoded seasons is too much for a
//     phone]. The share line is never shown from a part search (base null).
// The latest season always loads: its people and clubs fill the pickers.
// GAME MODE (#3137, games.js) runs the same two shapes over club-games: answerGames in place
// of answer, summarizeGames of summarize, and the games left out summed across seasons.

// The two modes behind one shape: `all` answers a pool, `part` one season's matches.
const PLAY = {
  all: (pas, q, cutoff) => answer(pas, q, cutoff),
  part: (pas, q, cutoff) => ({ ...answer(pas, q, cutoff, { matchesOnly: true }), leftOut: 0 }),
  sum: (found) => summarize(found),
}
const GAME = {
  all: answerGames,
  part: (pas, q, cutoff) => answerGames(pas, q, cutoff, { matchesOnly: true }),
  sum: (found, leftOut, q) => summarizeGames(found, null, leftOut, q),
}

const raceAbort = (promise, signal) =>
  new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')), { once: true })
    promise.then(resolve, reject)
  })

export function useResearch(q, cutoff) {
  const [index, setIndex] = useState(null)
  const [error, setError] = useState(null)
  const [head, setHead] = useState(null)
  const [lastRun, setRun] = useState(null)
  const stopper = useRef(null)

  useEffect(() => {
    fetchIndex().then(setIndex, setError)
  }, [])
  const onFile = useMemo(() => (index ? seasonsOnFile(index) : []), [index])
  const latest = onFile.at(-1)
  useEffect(() => {
    if (index && latest) loadSeason(index, latest).then(setHead, setError)
  }, [index, latest])

  // Game mode has no "What happens": a game link that asks it searches as "Last time".
  // Game mode reads runs per PA (games.js): a history season answers only once the store
  // carries them (`gameRuns`, #3163); before that rebuild the coverage line says "games
  // from 2015".
  const targets = useMemo(() => {
    const ts = seasonsFor(q.mode === 'game' && q.ask === 'what' ? { ...q, ask: 'last' } : q, onFile, cutoff)
    return q.mode === 'game' ? ts.filter((s) => s > HISTORY_LAST || index?.seasons[s]?.gameRuns) : ts
  }, [q, onFile, cutoff, index])
  const game = q.mode === 'game'
  // A chip the searched seasons cannot answer stays in the URL but out of the query. In game
  // mode the Pitches total needs pitch strings, near-complete only from 1988 (Gary, #3163).
  const blocked = useMemo(() => {
    if (!targets.length) return []
    const out = unsupported(Math.min(...targets), storeVersion(index, targets))
    if (game && Math.min(...targets) < PITCHES_SINCE) out.push({ key: 'pi', label: 'Pitches', since: PITCHES_SINCE, total: true })
    return out
  }, [targets, index, game])
  const live = useMemo(() => {
    const chips = { ...q.chips }
    for (const b of blocked) delete chips[b.key]
    if (!game) return { ...q, chips }
    const totals = { ...q.g?.totals }
    for (const b of blocked) if (b.total) delete totals[b.key]
    // A game query keeps only the cards that describe a whole game, and no person.
    for (const k of Object.keys(chips)) if (!GAME_CHIPS.includes(k)) delete chips[k]
    return { ...q, chips, g: { ...q.g, totals }, batter: null, pitcher: null, ask: q.ask === 'what' ? 'last' : q.ask }
  }, [q, blocked, game])
  const blank = game ? isGameBlank(live) : isBlank(live)

  // The "Who most" rank and minimum re-rank the answer on the page, so they never re-search.
  const key = JSON.stringify([searchKey(live), cutoff, targets])
  const run = lastRun?.key === key && !blank ? lastRun : null
  useEffect(() => {
    // A run is tagged with its key; one from an older query is never shown (below).
    if (!index || !head || blank || !targets.length) return undefined
    const ctrl = new AbortController()
    stopper.current = { ctrl, stopped: false }
    const bySeason = live.ask === 'last' && (!live.years || live.years[0] <= HISTORY_LAST)
    const mode = live.mode === 'game' ? GAME : PLAY
    let leftOut = 0
    const { res, ...baseChips } = live.chips // eslint-disable-line no-unused-vars
    const keep = matcher({ ...live, chips: baseChips }, cutoff)
    // A one-pass game question over a range that reaches history (#3163) answers season by
    // season and adds them up: a game never spans seasons, and a club filter cannot thin a
    // season's PAs (a club-game needs both sides). `gameBase`: club-games in scope.
    const perSeason = !bySeason && game && live.years?.[0] <= HISTORY_LAST
    let gameBase = 0
    const people = { ...head.people }
    const searched = []
    const found = []
    const pools = []
    let inflight = null
    let interim = null
    const step = (season, i, extra) => setRun({ key, result: interim, people: { ...people }, searched: [...searched], progress: { season, n: i + 1, of: targets.length }, ...extra })
    ;(async () => {
      for (const [i, season] of targets.entries()) {
        if (ctrl.signal.aborted) return
        if (bySeason && !mayMatch(live, seasonEvents(index, season))) {
          searched.push(season)
          continue
        }
        step(season, i)
        inflight = season
        const data = await raceAbort(loadSeason(index, season), ctrl.signal)
        // A Series game chip needs the season's postseason schedule (#3141).
        if (live.chips.sg?.vals.length) await raceAbort(attachSeries(season, data.pas), ctrl.signal)
        inflight = null
        Object.assign(people, data.people)
        searched.push(season)
        if (bySeason) {
          // A loop, not push(...): a broad card (count 0-0) matches 100k+ PAs a season, past
          // Safari's argument cap.
          const before = found.length
          const part = mode.part(data.pas, live, cutoff)
          for (const m of part.matches) found.push(m)
          leftOut += part.leftOut
          // The progress answer is rebuilt only when this season added matches.
          if (found.length > before) interim = mode.sum([...found], leftOut, live)
          if (season !== latest) dropSeason(season)
        } else if (perSeason) {
          const part = answerGames(data.pas, live, cutoff)
          for (const m of part.matches) found.push(m)
          gameBase += part.base
          leftOut += part.leftOut
          if (season !== latest) dropSeason(season)
        } else if (season > HISTORY_LAST) pools.unshift(data.pas)
        else {
          // A history season keeps only the PAs the answer can read (the query without its
          // result card: answer.js's base) and is freed, so a range back to 1961 fits a phone.
          pools.unshift(data.pas.filter(keep))
          dropSeason(season)
        }
      }
      const result = bySeason ? mode.sum(found, leftOut, live) : perSeason ? summarizeGames(found, gameBase, leftOut, live) : mode.all(pools.length === 1 ? pools[0] : pools.flat(), live, cutoff)
      // Free every season but the latest once answered (Gary, 2026-11-14): re-asking a
      // range downloads it again rather than holding twelve seasons on a phone.
      pools.length = 0
      dropSeasonsExcept([latest])
      setRun({ key, result, people, searched, progress: null })
    })().catch((e) => {
      // A failed run ends its progress line and keeps its error to its own query.
      if (e.name !== 'AbortError') setRun({ key, result: null, people, searched, progress: null, error: e })
      // Stopped: "Last time" shows what it found so far; a one-pass search found nothing
      // yet, so it shows no answer (an empty one would read "nothing matches").
      else if (stopper.current?.ctrl === ctrl && stopper.current.stopped) setRun({ key, result: bySeason ? mode.sum([...found], leftOut, live) : null, people, searched, progress: null, stopped: true })
    })
    // A replaced search frees the season it was still downloading (not the latest), so a
    // season the new search skips does not stay in memory for the visit.
    return () => {
      ctrl.abort()
      if (inflight != null && inflight !== latest) dropSeason(inflight)
    }
    // `key` stands for live, cutoff and targets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, index, head, latest])

  // Stop: end the search where it is and free the season in flight.
  const stop = () => {
    const s = stopper.current
    if (!s || run?.progress == null) return
    s.stopped = true
    if (run.progress.season !== latest) dropSeason(run.progress.season)
    s.ctrl.abort()
  }

  const cover = index && (run?.searched?.length || targets.length) ? coverage(index, run?.searched?.length && !run.progress ? run.searched : targets) : null
  return { index, error: error ?? run?.error ?? null, head, onFile, targets, blocked, live, blank, run, stop, cover, latest }
}
