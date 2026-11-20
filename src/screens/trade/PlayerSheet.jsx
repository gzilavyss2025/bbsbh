import { useRef, useState } from 'react'
import { CELL_LABELS } from '../../api/salaries.js'
import { money, contractYears, optionKind, optionStatus } from '../../lib/trade/deal.js'
import { pedigreeLine } from '../../lib/trade/pedigree.js'
import { isMlbTeamId, teamAbbr } from '../../lib/teams.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { ModalPortal } from '../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Numbers } from './Numbers.jsx'
import { TradeRecap } from './TradeSheet.jsx'
import { ProspectStamp } from './ProspectStamp.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { Ledger } from '../../components/player/Ledger.jsx'
import { fetchPlayerFacts } from '../../api/transactions/playerFacts.js'
import { FactSheet } from '../../components/transactions/FactSheet.jsx'
import { draftSentence } from '../../api/transactions/templates.js'
import { isoToday } from '../../lib/dates.js'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'

const DASH = '—'

// Everything about one player the row has no room for: every number, how he
// joined the club and his draft pick (a traded player's opens the trade), his
// contract year by year, retained salary when he is in the deal, and Add or
// Remove. Same .scrim/.sheet contract as the app's other sheets.
export function PlayerSheet({ p, teamId, nextYear, farm, warSeason = null, picked, onToggle, onClose, children = null }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  // His seasons, the way the transactions wire's sheet draws them: MLB, Minors
  // and Postseason, each by club with a career total. One read, shared with the wire.
  const today = isoToday()
  // No `asOf`: that adds the season-to-date and last-game reads (seconds of
  // calls) this sheet never shows; the seasons and the draft need only the person.
  const facts = useAsync(() => fetchPlayerFacts(p.id, { season: Number(today.slice(0, 4)), teamId }).catch(() => null), [p.id, teamId, today])
  const pedigree = pedigreeLine(p.how, p.draft, (id) => (isMlbTeamId(id) ? teamAbbr({ id }) : null))

  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet playersheet" role="dialog" aria-modal="true" aria-label={p.name}>
          <div className="tradesheet__head">
            <div className="playersheet__id">
              <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
              <div>
                <h2 className="sheet__title"><PlayerLink id={p.id} name={p.name}>{p.name}</PlayerLink></h2>
                <p className="t-label tradedesk__meta">
                  {p.pos || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
                </p>
              </div>
              {/* A ranked prospect who has already debuted keeps his stamp up by his
                  name; one who has not gets the big stamp in the prospect lead below. */}
              {(p.topRank || p.orgRank) && p.war != null && <ProspectStamp p={p} teamId={teamId} />}
            </div>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>

          {/* The trade case first: what he projects to, what he is worth, how long, for what. */}
          {p.value?.prospect && (p.topRank || p.orgRank)
            ? <ProspectLead p={p} teamId={teamId} farm={farm} pedigree={facts.data && draftSentence(facts.data) ? null : pedigree} />
            : <ValueTiles p={p} nextYear={nextYear} />}
          {!(p.value?.prospect && (p.topRank || p.orgRank)) && <p className="tradedesk__nums playersheet__nums">
            <Numbers p={p} nextYear={nextYear} farm={farm} warSeason={warSeason} full />
            {/* Whether a club can send him down sits with his other roster facts. */}
            {p.contract && optionStatus(p.contract.service, p.contract.options) && <span>{optionStatus(p.contract.service, p.contract.options)}</span>}
            {rule5Text(p) && <span><span className="tradedesk__k">Rule 5</span> {rule5Text(p)}</span>}
          </p>}

          <div className="playersheet__grid">
          <div className="playersheet__side">
            <ActionPhoto id={p.id} name={p.name} />
            {/* How he came up, under his picture: the sentence the seasons card would otherwise lead with. */}
            {facts.data && draftSentence(facts.data) && <p className="playersheet__draft">{draftSentence(facts.data)}</p>}
          </div>
          <div className="playersheet__main">

          {/* His seasons take a few calls to gather; say so rather than leave a gap. */}
          {facts.loading && !facts.data && <p className="hint playersheet__section" role="status">Reading his seasons…</p>}
          {facts.data && (
            <div className="playersheet__section">
              <h3 className="sr-only">Seasons</h3>
              <FactSheet people={[{ facts: facts.data, note: null }]} warByYear={p.warByYear} frame="ledger" />
            </div>
          )}

          {pedigree && (p.how?.kind === 'trade' || !facts.data) && (
            <div className="playersheet__section">
              <h3 className="t-label">How he got here</h3>
              {/* A trade tells itself below; the short line is for every other way in. */}
              {p.how?.kind !== 'trade' && <p className="playersheet__pedigree">{pedigree}</p>}
              {/* The trade that brought him, in place: who went each way and the wire's sentence. */}
              {p.how?.kind === 'trade' && <TradeRecap player={p} toId={teamId} />}
            </div>
          )}

          {/* No ledger on file (most minor leaguers): no section, rather than one saying so. */}
          {p.contract && (
            <div className="playersheet__section">
              <h3 className="t-label">Contract</h3>
              <ContractDetail c={p.contract} value={p.value} age={p.age} />
            </div>
          )}

          {children && (
            <div className="playersheet__section">
              <h3 className="t-label">Retained salary</h3>
              {children}
            </div>
          )}

          </div>
          </div>

          <div className="playersheet__actions">
            <Button skin={picked ? 'ink' : 'outline'} pressed={picked} onClick={() => onToggle(p.id)}>
              {picked ? 'Remove from deal' : 'Add to deal'}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// What the new club takes on, from next season: the money still owed, when he
// reaches free agency, then one row per year. The season already played, the
// raw Cot's terms and service days are left out. The foot says whether he can
// be sent down (optionStatus).
// Drawn as the seasons table is (the same Ledger): one row a year with what
// kind of year it is, his salary, and what he projects to (lib/trade/value.js),
// then the total. Unsigned years are estimates (value.js); the card says so once, in the summary.
function ContractDetail({ c, value = null, age = null }) {
  if (!c) return <p className="tradedesk__none">No contract on file yet.</p>
  const from = (c.cells[0]?.year ?? 0) + 1
  const ahead = contractYears(c, from)
  const free = ahead.find((x) => x.kind === 'free')
  const years = ahead.filter((x) => x.kind !== 'free')
  const owed = years.reduce((t, x) => t + (x.value ?? 0), 0)
  const unpriced = years.some((x) => x.value == null)
  const last = years.at(-1)?.year
  const summary = [
    years.length ? `${owed ? `${money(owed)}${unpriced ? '+' : ''} over` : ''} ${years.length} yr`.trim() : null,
    free ? `free agent in ${free.year}` : last ? `${c.regime === 'signed' ? 'signed' : 'control'} through ${last}` : 'free agent now',
  ].filter(Boolean).join(' · ')
  const projected = new Map((value?.years ?? []).map((y) => [y.year, y]))
  const kindText = (x) => (x.kind === 'arbitration' ? `Arb ${x.code?.slice(1) ?? ''}`.trim()
    : x.kind === 'preArb' ? 'Pre-arb' : x.kind === 'option' ? (optionKind(c.terms) ?? 'Option')
      : x.kind === 'salary' || x.kind === 'guaranteed' ? 'Signed' : CELL_LABELS[x.kind] ?? DASH)
  const pay = (x) => (x.value != null ? money(x.value) : projected.get(x.year)?.pay != null ? money(projected.get(x.year).pay) : DASH)
  const war = (x) => (projected.get(x.year) ? projected.get(x.year).war.toFixed(1) : DASH)
  // His age that season: the ledger's age is as of its own season (cells[0]).
  const ledgerSeason = c.cells[0]?.year ?? null
  const ageIn = (year) => (age != null && ledgerSeason != null ? age + (year - ledgerSeason) : DASH)
  const warTotal = [...projected.values()].reduce((t, y) => t + y.war, 0)
  // Signed salaries plus the estimated ones, so the total covers every year shown.
  const payTotal = years.reduce((t, x) => t + (x.value ?? projected.get(x.year)?.pay ?? 0), 0)
  return (
    <div className="playersheet__contract">
      <p className="playersheet__contractsum">{summary}</p>
      {years.length > 0 && (
        <Ledger
          label="Contract by year"
          leftCols={3}
          head={['Year', 'Age', 'Status', 'Salary', 'Proj. WAR']}
          rows={years.map((x) => ({ key: x.year, cells: [x.year, ageIn(x.year), kindText(x), pay(x), war(x)] }))}
          total={[payTotal ? money(payTotal) : DASH, projected.size ? warTotal.toFixed(1) : DASH]}
          totalLabel="Total"
        />
      )}
    </div>
  )
}

// The sheet's lead: four tiles, big figure over small label, for the numbers a
// trade turns on (lib/trade/value.js for the first two). A prospect's value is
// his rank's; pay marked ~ is an estimate.
function ValueTiles({ p, nextYear }) {
  const v = p.value
  if (!v) return null
  const pay = p.payUsd ?? p.payEstUsd
  const tiles = [
    v.projWar != null ? [`${nextYear} proj. WAR`, v.projWar.toFixed(1)] : null,
    [v.prospect ? 'Prospect value' : 'Surplus value', `${v.surplusUsd < 0 ? '−' : ''}${money(v.surplusUsd)}`],
    p.thru ? ['Control', `thru ${p.thru}${p.control ? ` · ${p.control} yr` : ''}`] : null,
    pay != null ? [`${nextYear} pay`, money(pay)] : p.payLabel ? [`${nextYear} pay`, p.payLabel] : null,
  ].filter(Boolean)
  return (
    <dl className="playersheet__tiles">
      {tiles.map(([label, value]) => (
        <div key={label} className="playersheet__tile">
          <dt className="tradedesk__k">{label}</dt>
          <dd className="playersheet__tilefig">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// A minor leaguer's Rule 5 line: when his club must add him to the 40-man or
// risk losing him in December's Rule 5 draft (lib/trade/pedigree.js rule5Year).
// A 40-man player is protected, so he has none.
function rule5Text(p, now = new Date()) {
  if (p.onForty || !p.rule5) return null
  const year = now.getFullYear()
  // The Rule 5 draft is held in December: before it, this year's class is still ahead.
  if (p.rule5 > year) return `Eligible Dec ${p.rule5}`
  if (p.rule5 === year && now.getMonth() < 11) return 'Eligible this December'
  return 'Eligible now'
}

// A prospect's lead, in place of the contract tiles he has no figures for:
// the deal card's rubber stamp drawn big (his rank, its tier, whose list),
// then the four facts a prospect has instead: his value by rank, where he
// plays now, and how his club got him (unless the draft sentence under his
// photo already says so).
// "Plays at": his highest level spelled out as the figure, his club there (its
// own mark and name) under it. The parent club is the sheet's already.
const LEVEL_WORDS = { ROK: 'Rookie', A: 'Single-A', 'A+': 'High-A', AA: 'Double-A', AAA: 'Triple-A' }
function PlaysAt({ level, club, clubId }) {
  const top = String(level).split(' · ').at(-1)
  return (
    <>
      {LEVEL_WORDS[top] ?? top}
      {club && (
        <span className="playersheet__tileteam">
          {clubId && <TeamLogo teamId={clubId} size={18} />}
          {club}
        </span>
      )}
    </>
  )
}

function ProspectLead({ p, teamId, farm, pedigree }) {
  const facts = [
    ['Prospect value', money(p.value.surplusUsd)],
    (farm?.level ?? p.level) ? ['Plays at', <PlaysAt key="at" level={farm?.level ?? p.level} club={farm?.club} clubId={farm?.clubId} />] : null,
    rule5Text(p) ? ['Rule 5', rule5Text(p)] : null,
    pedigree ? ['Came up', pedigree] : null,
  ].filter(Boolean)
  return (
    <div className="playersheet__prospect">
      <ProspectStamp p={p} teamId={teamId} big />
      <dl className="playersheet__tiles playersheet__tiles--prospect">
        {facts.map(([label, value]) => (
          <div key={label} className="playersheet__tile">
            <dt className="tradedesk__k">{label}</dt>
            <dd className="playersheet__tilefig">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// His action photo (the player page's hero art, lib/headshot/actionPhoto.js),
// shown only once it loads: a minor leaguer or a player with none keeps a
// sheet with no empty frame.
function ActionPhoto({ id, name }) {
  const [state, setState] = useState('loading')
  const url = actionPhotoUrl(id)
  if (!url || state === 'gone') return null
  return (
    <figure className={`playersheet__photo${state === 'ready' ? '' : ' playersheet__photo--loading'}`}>
      <img src={url} alt={name} onLoad={() => setState('ready')} onError={() => setState('gone')} />
    </figure>
  )
}
