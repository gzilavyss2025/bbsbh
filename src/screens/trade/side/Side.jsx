import { useEffect, useMemo, useState } from 'react'
import { fetchLevelLines } from '../../../api/trade/levelLines.js'
import { money, unsetSalary } from '../../../lib/trade/deal.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { teamClubName, teamFullName } from '../../../lib/teams.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Chips } from '../../../components/ui/control/Chips.jsx'
import { headerThemeFor, themeKeyFor } from '../../../lib/colors/headerTheme.js'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { PlayerRow } from '../PlayerRow.jsx'
import { POS_GROUPS, SPOTS, SHOW, SORT, levelRank, rosterList } from '../rosterList.js'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { SearchGlyph } from '../../../components/chrome/SiteSearch.jsx'
import { IconButton } from '../../../components/ui/control/IconButton.jsx'
import { DraftPicks } from '../DraftPicks.jsx'
import { LineupsGlyph } from './LineupSheet.jsx'

const DASH = '—'

// One club's column, the Trade Machine's shape: the club, what it gets from
// the other club (and what that does for it), then its own roster right
// there, where a tap sends a player across. No modal: the roster is the page.
export function Side({ bare = false, part = 'deal', draftPicks = [], dp = new Set(), onTogglePick, incomingPicks = [], teamId, state, incoming, incomingTeamId, incomingCash, partner, picked, onToggle, cash, onCash, after, effect = null, change, retainUI = null, onLineups = null, onDepth = null, farm = null, incomingFarm = null, requestFarm }) {
  const club = teamClubName(teamId)
  const data = state.data
  const theme = useMemo(() => headerThemeFor(teamId, themeKeyFor(teamId, 'home', 'main')), [teamId])
  // The club is its colour down the card's left edge, not a bar across the top.
  const edge = { '--club-edge': theme?.bar ?? 'var(--navy)' }
  const [group, setGroup] = useState('all')
  const [spot, setSpot] = useState('all')
  const [show, setShow] = useState('forty')
  // The player list last picked, so backing out to cash and returning keeps it.
  const [slice, setSlice] = useState('forty')
  const kind = show === 'cash' || show === 'picks' ? show : 'players'
  // Best first: WAR on the 40-man, rank on the prospect list (pickShow).
  const [sort, setSort] = useState('war')
  const [minimum, setMinimum] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  // The tabs past Everyone are not players: picks and cash hide the player filters.
  const players = show !== 'picks' && show !== 'cash'
  // A 40-man player with no big-league WAR shows his minor-league line, so the farm loads for him.
  useEffect(() => { if (part === 'roster' && data?.forty?.some((p) => p.war == null)) requestFarm() }, [part, data]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickShow = (v) => { setShow(v); if (v === 'prospects' || v === 'all') requestFarm(); if (v === 'prospects' && sort === 'war') setSort('prospect') }
  const byLevel = sort === 'level'
  // The line sort reads on one league scale (rosterList) under every filter, so
  // the number never changes meaning as the reader narrows the list.
  const lineIndexed = Boolean(data?.league)
  const lineByIndex = sort === 'line' && lineIndexed
  const cuts = useAsync(() => (byLevel ? fetchLevelLines() : Promise.resolve(null)), [byLevel])
  // A player the reader adds stamps into the column that gets him. The ones a
  // shared link or a reload brought are already there and do not replay it
  // (docs/motion.md). The set is taken once, the first render the deal is in;
  // adjusting state during render is React's documented pattern for this.
  const [arrived, setArrived] = useState(null)
  if (data && arrived === null) setArrived(new Set(incoming.map((p) => p.id)))
  // The roster card sits in its own row under the deal cards, so both clubs'
  // rosters start at the same height, whatever each deal card holds.
  if (part === 'roster') {
    return (
      <Card frame="stamped" className="tradedesk__side tradedesk__rostercard" style={edge}>
        {/* The club's main bar, the one the Identity Lab tunes and the lineup page
            wears: its bar colour, accent edge and ink, the mono mark bleeding the
            bar's full height, the full club name centred. Default navy when the
            club has no tuned bar. */}
        {/* One line: the club, what it adds (players, picks or cash), and Change. */}
        <div className="tradedesk__clubrow">
          <h2 className="tradedesk__clubbar">
            <TeamLogo teamId={teamId} size={28} />
            <span>{teamFullName(teamId)}</span>
          </h2>
          {data && (
            <Chips label={`${club} adds`} className="tradedesk__kinds" value={kind}
              options={KINDS.filter((k) => k.value !== 'picks' || draftPicks.length).map((k) => (k.value === 'cash' && cash ? { ...k, label: `Cash · ${money(cash * 1e6)}` } : k))}
              onChange={(k) => pickShow(k === 'players' ? slice : k)} />
          )}
          {/* With the deal cards waiting, the roster bar carries Change. */}
          {bare && change}
        </div>
      {state.loading && !data && <p className="hint" role="status">Reading the {club} roster…</p>}
      {state.error && !data && (
        <EmptyState role="alert"><p>The {club} roster did not load.</p><Button skin="ink" onClick={state.reload}>Try again</Button></EmptyState>
      )}
        {data && (
          <div className="tradedesk__roster">
            <div className="tradedesk__controls">
              {/* The card's top choice, what the club adds: players, its tradable
                  picks or cash. Tabs, always in view, so the filters under them
                  read as filters of the player list. */}
              {/* Which list, the order it reads in, and the search glass, on one line. */}
              {players && (
                <div className="tradedesk__showrow">
                  <Chips label={`${club} list`} options={SHOW} value={show} onChange={(v) => { setSlice(v); pickShow(v) }} className="tradedesk__lists" />
                  <select className={MORE_SORTS.some((o) => o.value === sort) ? 'tradedesk__sortmore tradedesk__sortmore--on' : 'tradedesk__sortmore'} aria-label="More ways to sort"
                    value={MORE_SORTS.some((o) => o.value === sort) ? sort : ''}
                    onChange={(e) => { if (!e.target.value) return; setSort(e.target.value); if (e.target.value === 'level') requestFarm() }}>
                    <option value="">Sort by…</option>
                    {/* The line sort names what the column will show: the league index with hitters and pitchers together. */}
                    {MORE_SORTS.map((o) => <option key={o.value} value={o.value}>{o.value === 'line' && lineIndexed ? 'OPS+ / ERA+' : o.label}</option>)}
                  </select>
                  {/* The search field stays tucked away behind its glass until tapped. */}
                  <IconButton className="tradedesk__searchbtn" aria-expanded={searching} onClick={() => { if (searching) setQuery(''); setSearching(!searching) }}
                    label={searching ? `Close ${club} search` : `Search ${club} players`}>
                    <SearchGlyph />
                  </IconButton>
                </div>
              )}
              {/* A group with positions under it (infield, outfield, pitchers) folds the
                  row to that one chip and slides its positions out beside it; tapping
                  the chip again folds them back in. */}
              {players && (SPOTS[group] ? (
                <div className="tradedesk__posrow">
                  <Button size="control" skin="ink" pressed onClick={() => { setGroup('all'); setSpot('all') }}>
                    {POS_GROUPS.find((g) => g.value === group).label}
                  </Button>
                  <div className="tradedesk__spots">
                    <Chips label={`${club} positions within the group`} options={SPOTS[group]} value={spot} onChange={setSpot} layout="wrap" />
                  </div>
                </div>
              ) : (
                <Chips label={`${club} positions`} options={POS_GROUPS} value={group} onChange={(g) => { setGroup(g); setSpot('all') }} />
              ))}
              {players && searching && <input type="search" className="tradedesk__search" value={query} onChange={(e) => setQuery(e.target.value)}
                autoFocus onBlur={() => { if (!query) setSearching(false) }}
                placeholder="Search" aria-label={`Search ${club} players`} />}
              {players && sort === 'line' && (
                <Chips label="Big-league lines" layout="wrap" value={minimum ? 'min' : 'any'} onChange={(v) => setMinimum(v === 'min')}
                  options={[{ value: 'min', label: '50 PA / 20 IP to count' }, { value: 'any', label: 'Any sample' }]} />
              )}
            </div>
            {show === 'picks' && <DraftPicks picks={draftPicks} chosen={dp} onToggle={onTogglePick} partner={partner} />}
            {show === 'cash' && (
              <label className="tradedesk__cash">
                <span className="t-label">{club} cash in {data.nextYear} ($M)</span>
                <input type="number" min="0" step="0.5" inputMode="decimal" value={cash || ''} placeholder="0"
                  onChange={(e) => onCash(Math.max(0, Number(e.target.value) || 0))} />
              </label>
            )}
            {/* The list's column heads double as its sort: tap one to order by it.
                The rarer orders sit in "More" at the row's end. */}
            {players && (
              <div className="tradedesk__sorthead" role="group" aria-label={`Sort the ${club} list`}>
                <span className="tradedesk__sortcols">
                  <span className="tradedesk__sortname">
                    <SortHead value="name" sort={sort} onSort={setSort}>Player</SortHead>
                  </span>
                  <span className="tradedesk__sortmoney">
                    <SortHead value="pay" sort={sort} onSort={setSort}>Salary</SortHead>
                    <SortHead value="control" sort={sort} onSort={setSort}>Yrs</SortHead>
                  </span>
                  {/* The figure column shows what the list is ordered by: OPS / ERA when that sort is on. */}
                  {sort === 'line'
                    ? <SortHead value="line" sort={sort} onSort={setSort} className="tradedesk__sortfig">{lineByIndex ? 'OPS+ / ERA+' : 'OPS / ERA'}</SortHead>
                    : <SortHead value="war" sort={sort} onSort={setSort} className="tradedesk__sortfig">WAR</SortHead>}
                </span>
                <span className="tradedesk__sortpad" aria-hidden="true" />
              </div>
            )}
            {players && <ul className="tradedesk__list tradedesk__rosterlist">
              {rosterList(data, { show, group, spot, sort, query, farm, minimum, cuts: cuts.data }).map((p) => (
                <PlayerRow key={p.id} p={p} teamId={teamId} picked={picked.has(p.id)} onToggle={onToggle} nextYear={data.nextYear} warSeason={data.warSeason}
                  farm={farm?.get(p.id)} figBy={sort === 'line' ? 'line' : null} league={lineByIndex ? data.league : null} rank={sort === 'level' ? levelRank(p, farm, cuts.data) : null} goingTo={picked.has(p.id) ? partner : null} />
              ))}
            </ul>}
          </div>
        )}
      </Card>
    )
  }
  return (
    <Card frame="stamped" className="tradedesk__side" style={edge}>
      {/* The Trade Machine's team bar: the club's colour, its name at the left,
          its figures at the right (40-man now and after), and the switch. */}
      <div className="tradedesk__dealbar">
        <TeamLogo teamId={teamId} size={28} />
        <h2 className="tradedesk__dealname">{club}</h2>
        {/* This club's lineup after the deal, the same sheet the tray opens. */}
        {onLineups && (
          <Button size="control" skin="outline" className="tradedesk__lineups" aria-label={`${club} lineup after the deal`} onClick={onLineups}>
            <LineupsGlyph /><span>Lineup</span>
          </Button>
        )}
        {onDepth && (
          <Button size="control" skin="outline" className="tradedesk__lineups" onClick={onDepth}>Depth</Button>
        )}
        <p className="tradedesk__dealfig">
          <span className="tradedesk__dealk">40-man</span>
          <span>
            {data ? `${data.fortyCount}/40` : DASH}
            {data && after != null && after !== data.fortyCount && (
              <span className={after > 40 ? 'tradedesk__after tradedesk__after--over' : 'tradedesk__after'}> → {after}/40</span>
            )}
          </span>
        </p>
        {change}
      </div>

      {state.loading && !data && <p className="hint" role="status">Reading the {club} roster…</p>}
      {state.error && !data && (
        <EmptyState role="alert"><p>The {club} roster did not load.</p><Button skin="ink" onClick={state.reload}>Try again</Button></EmptyState>
      )}

      {data && (
        <>
          {!partner && part === 'deal' && <p className="tradedesk__none">Pick a trade partner to start.</p>}
          {partner && (
            <div className="tradedesk__sends">
              {/* What this club gets: the other club's players and cash, at a glance. */}
              <p className="tradedesk__sendshead">
                <span className="t-label t-label--bold">Gets from the {partner}</span>
                <span className="tradedesk__sendssum">{sendsSummary(incoming, incomingCash, data.nextYear, incomingPicks.length)}</span>
              </p>
              {incoming.length === 0 && !incomingCash && !incomingPicks.length ? <p className="tradedesk__none">Nothing yet. Tap a player on the {partner} roster.</p> : (
                <ul className="tradedesk__list">
                  {incoming.map((p) => (
                    <PlayerRow compact key={p.id} p={p} teamId={incomingTeamId} picked onToggle={onToggle} nextYear={data.nextYear} warSeason={data.warSeason} farm={incomingFarm?.get(p.id)} enter={arrived != null && !arrived.has(p.id)}>
                      {retainUI && (p.payUsd != null || p.retainedUsd) ? retainUI(p) : null}
                    </PlayerRow>
                  ))}
                </ul>
              )}
              <DraftPicks compact picks={incomingPicks} chosen={dp} onToggle={onTogglePick} />
            </div>
          )}

          {effect}

        </>
      )}
    </Card>
  )
}

// "1 player · $28.7M in 2027 · + $2M cash", or "Nobody yet".
function sendsSummary(sends, cash, nextYear, picks = 0) {
  if (!sends.length && !cash && !picks) return 'Nobody yet'
  const pay = sends.reduce((t, p) => t + (p.payUsd ?? 0), 0)
  const unset = sends.filter(unsetSalary).length
  return [
    sends.length ? `${sends.length} ${sends.length === 1 ? 'player' : 'players'}` : null,
    pay ? `${money(pay)} in ${nextYear}${unset ? ` + ${unset} TBD` : ''}` : unset ? `${unset} TBD` : null,
    picks ? `${picks} ${picks === 1 ? 'draft pick' : 'draft picks'}` : null,
    cash ? `+ ${money(cash * 1e6)} cash` : null,
  ].filter(Boolean).join(' · ')
}

// The sorts with no column of their own, behind the list head's "More".
const MORE_SORTS = SORT.filter((o) => !['name', 'pay', 'control', 'war'].includes(o.value))

// One column head: tap to order the list by it; the current one is marked.
function SortHead({ value, sort, onSort, className = '', children }) {
  const on = sort === value
  return (
    <button type="button" className={['tradedesk__sorthd', on && 'tradedesk__sorthd--on', className].filter(Boolean).join(' ')}
      aria-pressed={on} onClick={() => onSort(value)}>
      {children}{on ? <span aria-hidden="true"> ▾</span> : null}
    </button>
  )
}

// The three things a club can add to a deal; the roster card's top row.
const KINDS = [
  { value: 'players', label: 'Players' },
  { value: 'cash', label: 'Cash' },
  { value: 'picks', label: 'Draft picks' },
]
