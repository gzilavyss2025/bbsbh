// Team history (#2019, the contract is in ../../CLAUDE.md): a season ledger of club badges. A farm
// club's badge flips to its parent org for that season. A band under the ledger shows a pennant for
// each season he played for a club that won its league (pennantsView.js). Replaces the tbd module's timeline card.
// Open surface (ADR-0034): no seal, no gate. A pre-debut player has no card (his Path card leads).
import { useEffect, useRef, useState } from 'react'
import '../../../../../styles/player-next/history/teams.css'
import { teamSeasonsView } from '../../../../../api/person.js'
import { fetchPersonStats, fetchPositions, fetchTransactions } from '../../../../../api/person-fetch.js'
import { resolveCareerOrgs } from '../../../../../api/careerTimeline.js'
import { yearByYearFor } from '../../../../../api/player/context.js'
import { dayBefore } from '../../../../../lib/dates.js'
import { familyBand } from '../../../../../api/person/family/family.js'
import { pennantFile } from '../../../../../api/history/leaguePennants.js'
import { fetchTeam } from '../../../../../api/team.js'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { FlipCard } from '../../../../../components/ui/FlipCard.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamAbbr } from '../../../../../lib/teams.js'
import { useRouteLink } from '../../../../../lib/nav.js'
import { teamPath } from '../../../../../lib/route.js'
import { yearAsOf } from '../../../../../lib/dates.js'
import { FamilyBand } from './FamilyBand.jsx'
import { PennantBand } from './PennantBand.jsx'
import { playerPennants } from './pennantsView.js'
import { badgeDoor, relativeLine, teamsView } from './teamsView.js'

const nicknames = async (ids) => {
  const teams = await Promise.all([...new Set(ids)].filter(Boolean).map(fetchTeam))
  return new Map(teams.filter(Boolean).map((t) => [t.id, t.teamName]))
}

// A relative's line needs his position and his MLB year-by-year (one read each).
async function withLines(band) {
  const pos = await fetchPositions(band.entries.map((e) => e.personId))
  const lines = await Promise.all(
    band.entries.map(async (e) => {
      if (!e.personId) return ''
      const splits = await fetchPersonStats(e.personId, { type: 'yearByYear', group: pos[e.personId] === 'P' ? 'pitching' : 'hitting' })
      const nick = await nicknames(splits.map((s) => s.team?.id))
      return relativeLine(pos[e.personId], splits, (id) => nick.get(id))
    }),
  )
  return { ...band, entries: band.entries.map((e, i) => ({ ...e, line: lines[i] })) }
}

async function loadTeams(bio, group, asOf) {
  if (!bio.debut) return null
  const [{ mlbYbySplits, milbYbySplits }, txns, band, pennants] = await Promise.all([
    yearByYearFor({ id: bio.id, bio }, group),
    fetchTransactions(bio.id, asOf ? dayBefore(asOf) : undefined),
    familyBand(bio.id),
    pennantFile(),
  ])
  const splits = [...mlbYbySplits, ...milbYbySplits]
  const ledger = teamSeasonsView(splits, group, Number(bio.debut.slice(0, 4)), await resolveCareerOrgs(splits))
  if (!ledger) return { id: bio.id, ledger }
  const [nick, family] = await Promise.all([
    nicknames(ledger.seasons.flatMap((s) => (s.stints ?? []).flatMap((x) => [x.teamId, x.orgId]))),
    band && withLines(band),
  ])
  return { id: bio.id, ledger, splits, mlbSplits: mlbYbySplits, pennants, trades: txns.filter((t) => t.typeCode === 'TR'), nick, family }
}

function Face({ teamId, name, sub, cur, flips }) {
  return (
    <span className={`teamhist__face${cur ? ' teamhist__face--cur' : ''}`}>
      <TeamLogo teamId={teamId} size={26} variant={cur ? 'mono' : 'base'} />
      <span className="teamhist__nm">
        <b>{name}</b>
        <span className="mono">{sub}</span>
      </span>
      {flips && <span className="teamhist__fl" aria-hidden="true">↻</span>}
    </span>
  )
}

// A badge flips on the first tap (#2779; Gary, 2026-11-05). An MLB badge's back face is the club in
// full; a farm badge's is its parent club, as before. The back face carries "Open {year} {club} →"
// to that club's season page (the row's last season). The flip is a button and the link is its own
// anchor beside it on the back face, so no control sits inside another.
function Badge({ b, season }) {
  const [flipped, setFlipped] = useState(false)
  const link = useRouteLink()
  // The face that just turned away is hidden, so a keyboard reader's focus follows the flip.
  const front = useRef(null)
  const backBtn = useRef(null)
  const turned = useRef(false)
  useEffect(() => {
    if (!turned.current) return
    ;(flipped ? backBtn : front).current?.focus()
  }, [flipped])
  const flip = (to) => {
    turned.current = true
    setFlipped(to)
  }
  const label = `${b.full}, ${b.sub.replace(' G', ' games')}${b.cur ? ', current club' : ''}`
  const door = badgeDoor(b, season)
  if (!door) {
    return (
      <div className="teamhist__badge" role="group" aria-label={label}>
        <Face {...b} />
      </div>
    )
  }
  const back = b.flip ?? { teamId: b.teamId, name: b.full, sub: b.sub, cur: b.cur }
  const href = teamPath(door.teamId, { name: door.full ?? undefined, d: yearAsOf(String(door.season)) })
  return (
    <div className="teamhist__badge">
      <FlipCard
        flipped={flipped}
        renderFront={() => (
          <button ref={front} type="button" className="teamhist__flip" aria-pressed={false} aria-label={`${label}. ${b.flip ? 'Flip to show the parent club.' : 'Flip for the season link.'}`} onClick={() => flip(true)}>
            <Face {...b} flips />
          </button>
        )}
        renderBack={() => (
          <div className="teamhist__back">
            <button ref={backBtn} type="button" className="teamhist__flip" aria-pressed aria-label={`${b.flip ? `Showing the parent club: ${b.flip.name}` : b.full}. Flip back.`} onClick={() => flip(false)}>
              <Face {...back} flips />
            </button>
            <a className="plink teamhist__door" {...link(href)}>
              Open {door.season} {door.name} →
            </a>
          </div>
        )}
      />
    </div>
  )
}

function Row({ r }) {
  return (
    <li className="teamhist__season">
      <span className="teamhist__yr mono">
        {r.years}
        {r.here && <span className="teamhist__here">Here now</span>}
      </span>
      <div className="teamhist__badges">
        {r.noSeason && <p className="teamhist__gap">{r.text}</p>}
        {r.items.map((x) =>
          x.kind === 'trade' ? (
            <span key={`tr-${x.date}`} className="teamhist__trade mono" role="note">
              Traded to <TeamLogo teamId={x.to} size={16} /> {teamAbbr({ id: x.to })} {x.date}
            </span>
          ) : (
            <Badge key={x.teamId} b={x} season={r.to} />
          ),
        )}
      </div>
      {r.note && <p className="teamhist__note">{r.note}</p>}
    </li>
  )
}

export default function TeamsModule({ bio, asOf, season, onEmpty, onCount }) {
  // The `once` slot hands a two-way player 'hitting'; a career is read on his primary group (bio.isPitcher).
  const group = bio.isPitcher ? 'pitching' : 'hitting'
  const { data, loading: busy } = useAsync(() => loadTeams(bio, group, asOf), [bio.id, group, asOf])
  // A guard only: useAsync already answers pending on the render the id changes (#2925).
  const mine = data?.id === bio.id
  const loading = busy || Boolean(data && !mine)
  const view =
    mine && data.ledger
      ? teamsView({
          ...data,
          nick: (id) => data.nick.get(id),
          currentTeamId: asOf ? null : bio.team?.id,
          season,
          asOfSeason: asOf ? Number(asOf.slice(0, 4)) : undefined,
        })
      : null
  const empty = !loading && !view
  const count = view?.count
  useEffect(() => {
    if (empty) onEmpty()
    onCount(count)
  }, [empty, count, onEmpty, onCount])

  if (!view) return loading ? <div className="teamhist teamhist--wait" aria-busy="true" /> : null
  return (
    <div className="teamhist">
      <ol className="teamhist__ledger">
        {view.rows.map((r) => (
          <Row key={r.years} r={r} />
        ))}
      </ol>
      <PennantBand pennants={playerPennants(data.pennants, data.mlbSplits, asOf ? Number(asOf.slice(0, 4)) : undefined)} />
      {data.family && <FamilyBand {...data.family} />}
    </div>
  )
}
