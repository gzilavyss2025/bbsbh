import { useEffect, useMemo, useRef, useState } from 'react'
import { answer, summarize } from '../../api/research/answer.js'
import { isBlank, mayMatch, searchKey, seasonsFor, unsupported } from '../../api/research/filters.js'
import { GAME_CHIPS, answerGames, isGameBlank, playerGames, summarizeGames } from '../../api/research/games.js'
import { STREAK_CHIPS, isStreakBlank, streakRun } from '../../api/research/streaks.js'
import { attachSeries, coverage, dropSeason, dropSeasonsExcept, fetchIndex, loadSeason, seasonEvents, seasonsOnFile, storeVersion } from '../../api/research/store.js'

// THE SEARCH behind /research (#2234, scope #2): which seasons a query reads, loading them,
// and the answer. filters.js seasonsFor picks the seasons. Two shapes:
//   ONE PASS. A Seasons range, or "How often" / "Who most" / "What happens" (latest season):
//     every season loads, then one answer over all of them.
//   SEASON BY SEASON. "Last time" with no range: newest season first, an answer after each,
//     until the oldest or Stop. A season whose index counts say it holds none of a picked
//     result is skipped unfetched (mayMatch). Each season is freed once read, the latest
//     excepted [DECISION: free every searched season, not only the ones with no match;
//     a homer search matches in all twelve, and twelve decoded seasons is too much for a
//     phone]. The share line is never shown from a part search (base null).
// The latest season always loads: its people and clubs fill the pickers.
// GAME MODE (#3137, games.js) runs the same two shapes over club-games: answerGames in place
// of answer, summarizeGames of summarize, and the games left out summed across seasons.

// STREAKS MODE (#3142, streaks.js) reads every season in range OLDEST first, since a streak
// carries across seasons: each season's player-game lines feed the run, then the season is
// freed. Stopped, it shows nothing (a streak cut short would read as the answer).

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
  // A streak search reads every season in range, so it searches as "Last time".
  const targets = useMemo(() => seasonsFor((q.mode === 'game' && q.ask === 'what') || q.mode === 'streak' ? { ...q, ask: 'last' } : q, onFile, cutoff), [q, onFile, cutoff])
  // A chip the searched seasons cannot answer stays in the URL but out of the query.
  const blocked = useMemo(() => (targets.length ? unsupported(Math.min(...targets), storeVersion(index, targets)) : []), [targets, index])
  const game = q.mode === 'game'
  const streak = q.mode === 'streak'
  const live = useMemo(() => {
    const chips = { ...q.chips }
    for (const b of blocked) delete chips[b.key]
    if (streak) {
      // A streak query keeps the Game type card, the one person on its side and the club.
      for (const k of Object.keys(chips)) if (!STREAK_CHIPS.includes(k)) delete chips[k]
      const pit = q.s.side === 'pit'
      return { ...q, chips, batter: pit ? null : q.batter, pitcher: pit ? q.pitcher : null, pitchTeam: null, park: null, ask: 'last' }
    }
    if (!game) return { ...q, chips }
    // A game query keeps only the cards that describe a whole game, and no person.
    for (const k of Object.keys(chips)) if (!GAME_CHIPS.includes(k)) delete chips[k]
    return { ...q, chips, batter: null, pitcher: null, ask: q.ask === 'what' ? 'last' : q.ask }
  }, [q, blocked, game, streak])
  const blank = streak ? isStreakBlank(live) : game ? isGameBlank(live) : isBlank(live)

  // The "Who most" rank and minimum re-rank the answer on the page, so they never re-search.
  const key = JSON.stringify([searchKey(live), cutoff, targets])
  const run = lastRun?.key === key && !blank ? lastRun : null
  useEffect(() => {
    // A run is tagged with its key; one from an older query is never shown (below).
    if (!index || !head || blank || !targets.length) return undefined
    const ctrl = new AbortController()
    stopper.current = { ctrl, stopped: false }
    const bySeason = live.ask === 'last' && !live.years
    const mode = live.mode === 'game' ? GAME : PLAY
    let leftOut = 0
    const people = { ...head.people }
    const searched = []
    const found = []
    const pools = []
    let inflight = null
    let interim = null
    const step = (season, i, extra) => setRun({ key, result: interim, people: { ...people }, searched: [...searched], progress: { season, n: i + 1, of: targets.length }, ...extra })
    if (live.mode === 'streak') {
      ;(async () => {
        const streakSeasons = [...targets].sort((a, b) => a - b)
        const runner = streakRun(live, cutoff)
        for (const [i, season] of streakSeasons.entries()) {
          step(season, i)
          inflight = season
          const data = await raceAbort(loadSeason(index, season), ctrl.signal)
          inflight = null
          Object.assign(people, data.people)
          searched.push(season)
          const lines = playerGames(data.pas)
          leftOut += lines.leftOut
          runner.feed(lines.lines)
          if (season !== latest) dropSeason(season)
        }
        // A run still going is active only when the search reached the latest season with
        // no `?d=` cutoff: a cutoff holds out the games that could have ended it.
        const activeFrom = streakSeasons.at(-1) === latest && !cutoff ? `${latest}-01-01` : null
        setRun({ key, result: { ...runner.finish({ activeFrom }), leftOut }, people, searched, progress: null })
      })().catch((e) => {
        if (e.name !== 'AbortError') setRun({ key, result: null, people, searched, progress: null, error: e })
        else if (stopper.current?.ctrl === ctrl && stopper.current.stopped) setRun({ key, result: null, people, searched, progress: null, stopped: true })
      })
      return () => {
        ctrl.abort()
        if (inflight != null && inflight !== latest) dropSeason(inflight)
      }
    }
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
        } else pools.unshift(data.pas)
      }
      const result = bySeason ? mode.sum(found, leftOut, live) : mode.all(pools.length === 1 ? pools[0] : pools.flat(), live, cutoff)
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
