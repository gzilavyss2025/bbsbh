// This page's own partial, kept out of the core sheet so only /team/{id}/franchise pays for it.
import '../../../styles/history/franchise.css'
import { Fragment } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js'
import { useRouteLink } from '../../../lib/nav.js'
import { managerPath, teamSeasonPath } from '../../../lib/route.js'
import { SiteHeader } from '../../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../../../components/ui/AsyncGate.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { Table } from '../../../components/ui/table/Table.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { loadFranchise, loadFranchisePeople } from './loadFranchise.js'
import { ledgerItems, oddSeasons, seasonCells } from './ledgerRows.js'
import { FranchiseSummary } from './summary/FranchiseSummary.jsx'
import { HallOfFame } from './people/HallOfFame.jsx'
import { RetiredNumbers } from './people/RetiredNumbers.jsx'
import { Managers } from './people/Managers.jsx'
import { Parks } from './people/Parks.jsx'
import { LeadersCard } from './leaders/LeadersCard.jsx'

// THE FRANCHISE PAGE (#2586, U1 #2763): one club across all its seasons, newest first, each row
// a door into that season's team page (`?y=`). The wireframe Gary picked is Phone B (one table
// that scrolls sideways in its own box, the year pinned) and a full-width table on a wide screen.
// U2 (#2784, wireframe approved 2026-11-05) adds the summary, first on a phone and in a side
// column at the widest step, and People and places under the ledger. U3 (#2785) puts the
// all-time leaders card between them; #2788 adds the parks. History, an open surface
// (ADR-0034): nothing is sealed, and the page reads no cutoff.

const COLUMNS = 10

export function TeamFranchisePage({ id }) {
  const teamId = Number(id)
  const { loading, error, data } = useAsync(() => loadFranchise(teamId), [teamId])
  // People and places waits for the ledger and never holds it up; a MiLB club (no rows) reads none.
  const hasRows = Boolean(data?.rows?.length)
  const people = useAsync(() => (hasRows ? loadFranchisePeople(teamId) : null), [teamId, hasRows]).data
  useDocumentTitle(data?.team ? `${data.team.name} · Franchise History` : null)
  const back = () => window.history.back()

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const { team, rows, summary } = data
  const first = rows[0]?.season
  const last = rows[rows.length - 1]?.season
  return (
    <div className="screen team-hub frpage">
      <SiteHeader />
      <BackBtn onClick={back} />
      <header className="team-hub__id">
        <div className="team-hub__logo">
          <TeamLogo teamId={team.id} name={team.name} size={64} />
        </div>
        <div>
          <h1>{team.name}</h1>
          <p className="team-hub__rec">
            <span className="team-hub__div">
              Franchise history{first ? ` · ${first}–${last}` : ''}
            </span>
          </p>
        </div>
      </header>
      {rows.length ? (
        <div className="frpage__body">
          <aside className="frpage__side" aria-label="Franchise summary">
            <FranchiseSummary summary={summary} />
          </aside>
          <div className="frpage__main">
            <Ledger team={team} rows={rows} />
            {people && <LeadersCard leaders={people.leaders} />}
            <section className="frpage__people" aria-labelledby="frpage-people">
              <SectionHead look="band" house as="h2" titleId="frpage-people">
                People and places
              </SectionHead>
              <div className="frpage__cards">
                {people && <HallOfFame team={team} hof={people.hof} names={summary?.names} />}
                {people && <RetiredNumbers retired={people.retired} hof={people.hof} leaders={people.leaders} />}
                <Managers managers={summary?.managers} best={summary?.winningestManager?.id ?? null} />
                {people && <Parks history={people.history} live={people.venues} />}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <EmptyState className="frpage__empty">Franchise history covers the 30 MLB clubs.</EmptyState>
      )}
    </div>
  )
}

function Ledger({ team, rows }) {
  const link = useRouteLink()
  // A past season opens at `?y=` (its last day); this season opens the live page.
  const seasonHref = (season) => teamSeasonPath(team.id, season, { name: team.name })
  const odd = oddSeasons(rows)
  return (
    <Card frame="stamped" body="flush" label="Season by season" count={`${rows.length} ${rows.length === 1 ? 'season' : 'seasons'}`} className="frl">
      <Table frame="bare" sticky label="Season by season" className="frl__grid">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">W-L</th>
            <th scope="col">Pct</th>
            <th scope="col">Fin</th>
            <th scope="col">GB</th>
            <th scope="col" className="frl__left">Post</th>
            <th scope="col">R</th>
            <th scope="col">RA</th>
            <th scope="col">Diff</th>
            <th scope="col" className="frl__left">Manager</th>
          </tr>
        </thead>
        <tbody>
          {ledgerItems(rows).map((item) =>
            item.kind === 'band' ? (
              <tr key={`band-${item.from}`} className="frl__band">
                <th scope="rowgroup" colSpan={COLUMNS}>
                  {item.name} · {item.from === item.to ? item.from : `${item.from}–${item.to}`}
                </th>
              </tr>
            ) : (
              <SeasonRow key={item.row.season} c={seasonCells(item.row)} href={seasonHref(item.row.season)} link={link} />
            ),
          )}
        </tbody>
      </Table>
      {odd && <p className="hint frl__hint">Odd seasons: {odd}.</p>}
    </Card>
  )
}

function SeasonRow({ c, href, link }) {
  return (
    <tr className="frl__row">
      <th scope="row">
        <a className="plink frl__year" {...link(href)}>
          {c.season}
        </a>
        {c.tag && <span className="frl__tag">{c.tag}</span>}
        {c.inProgress && <span className="frl__live">In progress</span>}
      </th>
      <td>{c.wl}</td>
      <td>{c.pct}</td>
      <td>{c.finish}</td>
      <td>{c.gb}</td>
      <td className="frl__left frl__post">
        {c.post.title ? (
          <Pill fill="marker">
            <span className="frl__short">{c.post.short}</span>
            <span className="frl__long">{c.post.long}</span>
          </Pill>
        ) : (
          <>
            <span className="frl__short">{c.post.short}</span>
            <span className="frl__long">{c.post.long}</span>
          </>
        )}
      </td>
      <td>{c.rs}</td>
      <td>{c.ra}</td>
      <td>{c.diff}</td>
      <td className="frl__left">
        {c.managers.map((m, i) => (
          <Fragment key={m.id}>
            {i > 0 && ', '}
            <a className="plink" {...link(managerPath(m.id, m.name))}>
              {m.name}
            </a>
          </Fragment>
        ))}
        {!c.managers.length && '—'}
      </td>
    </tr>
  )
}
