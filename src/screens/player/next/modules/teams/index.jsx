// Team history (#2019, the contract is in ../../CLAUDE.md): a season ledger of club badges. A farm
// club's badge flips to its parent org for that season. A band under the ledger shows a pennant for
// each season he played for a club that won its league (pennantsView.js). Replaces the tbd module's timeline card.
// Open surface (ADR-0034): no seal, no gate. A pre-debut player has no card (his Path card leads).
import { useEffect, useState } from 'react'
import '../../../../../styles/player-next/history/teams.css'
import { teamSeasonsView } from '../../../../../api/person.js'
import { fetchPersonStats, fetchPositions, fetchTransactions } from '../../../../../api/person-fetch.js'
import { resolveCareerOrgs } from '../../../../../api/careerTimeline.js'
import { dayBefore, yearByYearFor } from '../../../../../api/player/context.js'
import { familyBand } from '../../../../../api/person/family/family.js'
import { pennantFile } from '../../../../../api/history/leaguePennants.js'
import { fetchTeam } from '../../../../../api/team.js'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { FlipCard } from '../../../../../components/ui/FlipCard.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamAbbr } from '../../../../../lib/teams.js'
import { FamilyBand } from './FamilyBand.jsx'
import { PennantBand } from './PennantBand.jsx'
import { playerPennants } from './pennantsView.js'
import { relativeLine, teamsView } from './teamsView.js'

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

function Badge({ b }) {
  const [flipped, setFlipped] = useState(false)
  const label = `${b.full}, ${b.sub.replace(' G', ' games')}${b.cur ? ', current club' : ''}`
  if (!b.flip) {
    return (
      <div className="teamhist__badge" role="group" aria-label={label}>
        <Face {...b} />
      </div>
    )
  }
  return (
    <button
      type="button"
      className="teamhist__badge"
      aria-pressed={flipped}
      aria-label={`${label}. ${flipped ? `Showing the parent club: ${b.flip.name}.` : 'Flip to show the parent club.'}`}
      onClick={() => setFlipped((f) => !f)}
    >
      <FlipCard
        flipped={flipped}
        renderFront={() => <Face {...b} flips />}
        renderBack={() => <Face {...b.flip} flips />}
      />
    </button>
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
            <Badge key={x.teamId} b={x} />
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
  // useAsync keeps the last player's data for one render after the id changes.
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
