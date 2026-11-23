import { useEffect, useRef, useState } from 'react'
import { tradeParties, gradeLine } from '../../lib/trade/wireGrade.js'
import { gradeOf } from '../../lib/trade/value.js'
import { gradeWireTrade } from '../../api/trade/wireGrade.js'
import { teamAbbr, teamClubName } from '../../lib/teams.js'
import { pathOf } from '../../lib/route/table.js'
import { useRouteLink } from '../../lib/nav.js'

// A trade's grade on the wire, run on at the end of its player notes just
// before More: "Grades: Dodgers A, Twins C."
// The label opens the Trade Simulator with both clubs, which is where the
// grade comes from and where it explains itself. Read only once the row is
// near the screen (each grade is a few statsapi calls); no line at all for a
// deal that cannot be scored.
export function WireGrade({ story }) {
  const parties = tradeParties(story)
  const ref = useRef(null)
  const [near, setNear] = useState(false)
  const [graded, setGraded] = useState(null)
  const link = useRouteLink()
  useEffect(() => {
    const el = ref.current
    if (!parties || near || !el) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [parties, near])
  const key = parties ? `${parties.clubId}:${parties.otherId}:${parties.got}:${parties.gave}` : ''
  useEffect(() => {
    if (!near || !parties) return undefined
    let live = true
    gradeWireTrade(parties).then((g) => live && setGraded(g))
    return () => { live = false }
  }, [near, key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!parties) return null
  if (!graded) return <span ref={ref} aria-hidden="true" />
  const text = gradeLine({ club: teamClubName(parties.clubId), other: teamClubName(parties.otherId), valueUsd: graded.valueUsd, cash: parties.cash, toBeNamed: parties.toBeNamed }, gradeOf)
  // The players picked too. The simulator deals from today's rosters, where
  // each already sits with his new club, so the deal opens reversed: the
  // trade undone, its grades mirrored (Gary's call, 2026-11-23).
  const ids = [...parties.got, ...parties.gave].join(',')
  const path = `${pathOf('trade')}?team=${teamAbbr({ id: parties.clubId })}&with=${teamAbbr({ id: parties.otherId })}${ids ? `&p=${ids}` : ''}`
  // Runs on in the notes' sentence, ahead of More (WireFacts' `extra`).
  return (
    <span className="wire__grade">
      <a className="wire__gradelabel" {...link(path)}>Grades</a>: {text}{' '}
    </span>
  )
}
