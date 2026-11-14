import { useEffect, useMemo, useRef, useState } from 'react'
import { answer, summarize } from '../../api/research/answer.js'
import { isBlank, mayMatch, seasonsFor, unsupported } from '../../api/research/filters.js'
import { coverage, dropSeason, dropSeasonsExcept, fetchIndex, loadSeason, seasonEvents, seasonsOnFile } from '../../api/research/store.js'

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

  const targets = useMemo(() => seasonsFor(q, onFile, cutoff), [q, onFile, cutoff])
  // A chip the searched seasons cannot answer stays in the URL but out of the query.
  const blocked = useMemo(() => (targets.length ? unsupported(Math.min(...targets)) : []), [targets])
  const live = useMemo(() => {
    const chips = { ...q.chips }
    for (const b of blocked) delete chips[b.key]
    return { ...q, chips }
  }, [q, blocked])
  const blank = isBlank(live)

  const key = JSON.stringify([live, cutoff, targets])
  const run = lastRun?.key === key && !blank ? lastRun : null
  useEffect(() => {
    // A run is tagged with its key; one from an older query is never shown (below).
    if (!index || !head || blank || !targets.length) return undefined
    const ctrl = new AbortController()
    stopper.current = { ctrl, stopped: false }
    const bySeason = live.ask === 'last' && !live.years
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
        inflight = null
        Object.assign(people, data.people)
        searched.push(season)
        if (bySeason) {
          // A loop, not push(...): a broad card (count 0-0) matches 100k+ PAs a season, past
          // Safari's argument cap.
          const before = found.length
          for (const m of answer(data.pas, live, cutoff, { matchesOnly: true }).matches) found.push(m)
          // The progress answer is rebuilt only when this season added matches.
          if (found.length > before) interim = summarize([...found])
          if (season !== latest) dropSeason(season)
        } else pools.unshift(data.pas)
      }
      const result = bySeason ? summarize(found) : answer(pools.length === 1 ? pools[0] : pools.flat(), live, cutoff)
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
      else if (stopper.current?.ctrl === ctrl && stopper.current.stopped) setRun({ key, result: bySeason ? summarize([...found]) : null, people, searched, progress: null, stopped: true })
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
