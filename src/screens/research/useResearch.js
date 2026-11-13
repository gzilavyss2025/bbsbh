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
    const step = (season, i, extra) => setRun({ key, result: bySeason && found.length ? summarize([...found]) : null, people: { ...people }, searched: [...searched], progress: { season, n: i + 1, of: targets.length }, ...extra })
    ;(async () => {
      for (const [i, season] of targets.entries()) {
        if (ctrl.signal.aborted) break
        if (bySeason && !mayMatch(live, seasonEvents(index, season))) {
          searched.push(season)
          continue
        }
        step(season, i)
        const data = await raceAbort(loadSeason(index, season), ctrl.signal)
        Object.assign(people, data.people)
        searched.push(season)
        if (bySeason) {
          found.push(...answer(data.pas, live, cutoff).matches)
          if (season !== latest) dropSeason(season)
        } else pools.unshift(data.pas)
      }
      if (!bySeason) dropSeasonsExcept([...targets, latest])
      const result = bySeason ? summarize(found) : answer(pools.length === 1 ? pools[0] : pools.flat(), live, cutoff)
      setRun({ key, result, people, searched, progress: null })
    })().catch((e) => {
      if (e.name !== 'AbortError') setError(e)
      else if (stopper.current?.ctrl === ctrl && stopper.current.stopped) setRun({ key, result: summarize([...found]), people, searched, progress: null, stopped: true })
    })
    return () => ctrl.abort()
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
  return { index, error, head, onFile, targets, blocked, live, blank, run, stop, cover, latest }
}
