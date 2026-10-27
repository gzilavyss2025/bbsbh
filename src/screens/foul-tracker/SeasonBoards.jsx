import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { teamAbbr, teamFullName } from '../../lib/teams.js'
import { Table } from '../../components/ui/table/Table.jsx'
import { BoardCard, favRowProps, pct1 } from './Boards.jsx'

// A hero stat leading the page — the numbers every leaderboard below assumes
// the reader already has context for, read as a sentence rather than a bare
// figure. `league.totals` is the whole (unfiltered) season's pitch/foul sums
// (see gen-fouls.mjs's exportFouls), so this reads the same regardless of the
// team filter, same as ByInning/ByPitchType below it. `avgFoulsPerPA` sums
// EVERY batter's own season `pa` (data.batters has no minimum-games floor,
// unlike the leaderboards below, so this total is the true league PA count).
// `avgFoulsPerStart` reuses byInning's own vsStarter split (the same "was a
// starter on the mound" cut ByInning renders) rather than each pitcher's own
// season totals, since a pitcher's `g`/`fouls` mix starts AND any relief
// appearances together — vsStarter.fouls is already scoped to starter innings
// only. Total starts is gamesIngested * 2 (exactly one starter per team per
// game) — nothing in the precompute tracks a league-wide start COUNT directly.
// The fill bar is a genuine proportion (this share of an average game's
// PITCHES got fouled off), not decoration.
export function SeasonAverageCard({ data }) {
  const league = data?.league
  const gamesIngested = data?.gamesIngested
  if (!league?.totals || !gamesIngested) return null
  const avgFouls = league.totals.fouls / gamesIngested
  const avgPitches = league.totals.pitches / gamesIngested
  const foulRate = league.totals.pitches > 0 ? league.totals.fouls / league.totals.pitches : 0

  const totalPA = Object.values(data?.batters ?? {}).reduce((s, b) => s + (b.pa || 0), 0)
  const avgFoulsPerPA = totalPA > 0 ? league.totals.fouls / totalPA : null

  const starterFouls = (league.byInning ?? []).reduce((s, r) => s + (r.vsStarter?.fouls ?? 0), 0)
  const totalStarts = gamesIngested * 2
  const avgFoulsPerStart = totalStarts > 0 ? starterFouls / totalStarts : null

  return (
    <Card as="div" body="flush" className="foulavg">
      <p className="foulavg__note">
        There are <b>{Math.round(avgPitches)}</b> pitches thrown in an average MLB game and{' '}
        <b>{Math.round(avgFouls)}</b> are fouled off ({pct1(foulRate)}). The average plate appearance features{' '}
        <b>{avgFoulsPerPA == null ? '—' : avgFoulsPerPA.toFixed(1)}</b> foul balls, and a starting pitcher averages{' '}
        <b>{avgFoulsPerStart == null ? '—' : avgFoulsPerStart.toFixed(1)}</b> foul balls per start.
      </p>
      <div
        className="foulavg__meter"
        role="img"
        aria-label={`${pct1(foulRate)} of an average game's pitches are fouled off`}
      >
        <span className="foulavg__fill" style={{ width: `${Math.min(foulRate * 100, 100).toFixed(1)}%` }} />
      </div>
    </Card>
  )
}

// The by-inning foul curve — does fouling spike late? — split vs. starters
// and vs. relievers. This chart doesn't exist anywhere else in public
// baseball data, which is half the fun of publishing it.
export function ByInning({ league }) {
  const rows = league?.byInning ?? []
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => (r.pitches > 0 ? r.fouls / r.pitches : 0)))
  return (
    <BoardCard title="Foul rate by inning">
      <Table frame="bare" className="foulboard">
        <thead>
          <tr>
            <th className="team">Inning</th>
            <th className="foulboard__barcol" aria-hidden="true"></th>
            <th>All</th>
            <th>Starters</th>
            <th>Bullpen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rate = r.pitches > 0 ? r.fouls / r.pitches : 0
            const sp = r.vsStarter?.pitches > 0 ? r.vsStarter.fouls / r.vsStarter.pitches : null
            const rp = r.vsReliever?.pitches > 0 ? r.vsReliever.fouls / r.vsReliever.pitches : null
            return (
              <tr key={r.inning}>
                <td className="team">{r.inning >= 10 ? '10+' : r.inning}</td>
                <td className="foulboard__barcol">
                  <span
                    className="foulboard__bar"
                    style={{ width: max > 0 ? `${(rate / max) * 100}%` : 0 }}
                  />
                </td>
                <td>{pct1(rate)}</td>
                <td>{sp == null ? '—' : pct1(sp)}</td>
                <td>{rp == null ? '—' : pct1(rp)}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </BoardCard>
  )
}

// The standard Statcast/FanGraphs pitch-family grouping — codes not listed
// fall into 'Other' (knuckleball, eephus, and anything the feed hasn't
// labeled yet) rather than erroring, same defensive-fallback rule the rest of
// the app applies to feed fields. FC (cutter) rides with the fastballs — it's
// thrown from the fastball grip/arm-slot, unlike the breaking pitches below.
const PITCH_CATEGORY = {
  FF: 'Fastballs', FA: 'Fastballs', FT: 'Fastballs', SI: 'Fastballs', FC: 'Fastballs',
  SL: 'Breaking balls', CU: 'Breaking balls', KC: 'Breaking balls', CS: 'Breaking balls',
  ST: 'Breaking balls', SV: 'Breaking balls', SC: 'Breaking balls',
  CH: 'Offspeed', FS: 'Offspeed', FO: 'Offspeed',
}
const PITCH_CATEGORY_ORDER = ['Fastballs', 'Breaking balls', 'Offspeed', 'Other']

// Team-view sample floor — MUCH lower than the league table's 500, since one
// club's own season volume for a single pitch type is a fraction of the
// league's (a rare pitch like a splitter might only see a few hundred pitches
// against/from one team all year).
const MIN_TEAM_PITCH_COUNT = 30

// A batting/pitching foul-rate gap this wide (5 percentage points) or more is
// worth flagging automatically — foul rates cluster in a fairly narrow 10-30%
// band leaguewide, so a 5-point split between a team's own two sides is a
// real outlier, not sampling noise.
const SIGNIFICANT_RATE_GAP = 0.05

// Merges a team's battingRates/pitchingRates (from teamPitchTypeRates) into
// one row per pitch code the team saw on EITHER side, each carrying a raw
// pitch count (seen/thrown) plus a foul% and whiff% — both pure rates, not a
// count riding along in the same cell — independently per side (null/dash if
// that side never reached the floor). `isOutlier` flags a foul%-gap wide
// enough to call out automatically (see SIGNIFICANT_RATE_GAP) — only
// computable when BOTH sides cleared the sample floor, never from one lone
// side.
export function buildTeamPitchTypeRows(rates) {
  const battingByCode = new Map((rates?.batting ?? []).map((r) => [r.code, r]))
  const pitchingByCode = new Map((rates?.pitching ?? []).map((r) => [r.code, r]))
  const codes = new Set([...battingByCode.keys(), ...pitchingByCode.keys()])
  const whiffRate = (whiffs, pitches) => (pitches > 0 ? whiffs / pitches : null)
  return [...codes]
    .map((code) => {
      const b = battingByCode.get(code)
      const p = pitchingByCode.get(code)
      const battingPitches = b?.pitches ?? 0
      const pitchingPitches = p?.pitches ?? 0
      const battingRate = b?.foulRate ?? null
      const pitchingRate = p?.foulRate ?? null
      const gap = battingRate != null && pitchingRate != null ? Math.abs(battingRate - pitchingRate) : null
      return {
        code,
        description: b?.description || p?.description || code,
        category: PITCH_CATEGORY[code] ?? 'Other',
        battingPitches,
        battingRate,
        battingWhiffRate: whiffRate(b?.whiffs ?? 0, battingPitches),
        pitchingPitches,
        pitchingRate,
        pitchingWhiffRate: whiffRate(p?.whiffs ?? 0, pitchingPitches),
        isOutlier: gap != null && gap >= SIGNIFICANT_RATE_GAP,
      }
    })
    .filter((r) => r.battingPitches >= MIN_TEAM_PITCH_COUNT || r.pitchingPitches >= MIN_TEAM_PITCH_COUNT)
}

// `teamRates` (from FoulTrackerPage's buildBoards, only set once a team
// filter is active) swaps the league-wide single-rate table for a two-sided
// batters-vs-pitchers comparison scoped to that club — the plain league rate
// stops being the interesting question once you've already narrowed to one
// team. Reverts to the league table the moment the filter clears.
export function ByPitchType({ league, teamRates }) {
  if (teamRates) {
    const rows = buildTeamPitchTypeRows(teamRates)
    if (rows.length === 0) return null
    const groups = PITCH_CATEGORY_ORDER.map((category) => ({
      category,
      rows: rows
        .filter((r) => r.category === category)
        .sort((a, b) => b.battingPitches + b.pitchingPitches - (a.battingPitches + a.pitchingPitches)),
    })).filter((g) => g.rows.length > 0)
    return (
      <BoardCard title="Foul rate by pitch type">
        <Table frame="bare" label="Foul rate by pitch type" className="foulboard">
          <tbody>
            {groups.map((g) => (
              <TeamPitchCategoryGroup key={g.category} group={g} />
            ))}
          </tbody>
        </Table>
      </BoardCard>
    )
  }

  const rows = (league?.byPitchType ?? [])
    .filter((r) => r.pitches >= 500)
    .map((r) => ({
      ...r,
      rate: r.fouls / r.pitches,
      // Preserve null (rather than defaulting to 0) so a row genuinely missing
      // whiff data renders '—' below, not a misleading 0.0%.
      whiffRate: r.whiffs == null ? null : r.whiffs / r.pitches,
      category: PITCH_CATEGORY[r.code] ?? 'Other',
    }))
  if (rows.length === 0) return null
  const groups = PITCH_CATEGORY_ORDER.map((category) => ({
    category,
    rows: rows.filter((r) => r.category === category).sort((a, b) => b.rate - a.rate),
  })).filter((g) => g.rows.length > 0)
  return (
    <BoardCard title="Foul rate by pitch type">
      <Table frame="bare" label="Foul rate by pitch type" className="foulboard">
        <tbody>
          {groups.map((g) => (
            <PitchCategoryGroup key={g.category} group={g} />
          ))}
        </tbody>
      </Table>
    </BoardCard>
  )
}

// Same navy subheader shape as PitchCategoryGroup below, but split into
// two 3-column groups (batters' own vs. pitchers' own): a raw pitch count
// leads each side (# seen for batters, # thrown for pitchers), then foul% and
// whiff% follow as plain percentages — no count riding along in either rate
// cell, so every number in a rate column is directly comparable to the one
// above/below it. A row whose two foul% figures diverge by SIGNIFICANT_
// RATE_GAP or more gets a soft --marker "outlier" wash, the app's "notable, look
// here" colour, rather than a new accent.
export function TeamPitchCategoryGroup({ group }) {
  return (
    <>
      <tr className="foulboard__grouprow foulboard__grouprow--navy">
        <th colSpan={7} scope="rowgroup">
          {group.category}
        </th>
      </tr>
      <tr className="foulboard__subhead">
        <th className="team">Pitch</th>
        <th># Seen</th>
        <th>Batters Foul%</th>
        <th>Batters Whiff%</th>
        <th># Thrown</th>
        <th>Pitchers Foul%</th>
        <th>Pitchers Whiff%</th>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.code} className={r.isOutlier ? 'foulboard__row--outlier' : undefined}>
          <td className="team">{r.description || r.code}</td>
          <td>{r.battingPitches > 0 ? r.battingPitches.toLocaleString('en-US') : '—'}</td>
          <td>{r.battingRate == null ? '—' : pct1(r.battingRate)}</td>
          <td>{r.battingWhiffRate == null ? '—' : pct1(r.battingWhiffRate)}</td>
          <td>{r.pitchingPitches > 0 ? r.pitchingPitches.toLocaleString('en-US') : '—'}</td>
          <td>{r.pitchingRate == null ? '—' : pct1(r.pitchingRate)}</td>
          <td>{r.pitchingWhiffRate == null ? '—' : pct1(r.pitchingWhiffRate)}</td>
        </tr>
      ))}
    </>
  )
}

// One pitch-family's navy subheader row (spans the table), its OWN
// repeated Pitch/Pitches/Foul%/Whiff% column header, then its pitch-type
// rows — a real <tbody> boundary per group so the row-divider rules (the
// Table's per-cell hairline, system/table.css) don't have to special-case
// the subheaders visually. The column header repeats under every category
// (rather than once at the table's top) since a reader scanning straight to
// "Breaking balls" shouldn't have to scroll back up to remember which column
// is which. Pitches leads (the sample size a reader should weigh the two
// rates against) with Foul%/Whiff% following, same left-to-right order as
// TeamPitchCategoryGroup's own Seen/Foul%/Whiff% triplet below.
export function PitchCategoryGroup({ group }) {
  return (
    <>
      <tr className="foulboard__grouprow foulboard__grouprow--navy">
        <th colSpan={4} scope="rowgroup">
          {group.category}
        </th>
      </tr>
      <tr className="foulboard__subhead">
        <th className="team">Pitch</th>
        <th>Pitches</th>
        <th>Foul%</th>
        <th>Whiff%</th>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.code}>
          <td className="team">{r.description || r.code}</td>
          <td>{r.pitches.toLocaleString('en-US')}</td>
          <td>{pct1(r.rate)}</td>
          <td>{r.whiffRate == null ? '—' : pct1(r.whiffRate)}</td>
        </tr>
      ))}
    </>
  )
}

export function TeamBoard({ teams, favoriteTeamId, compare }) {
  if (!teams || teams.length === 0) return null
  return (
    <BoardCard title="Team fouls per game">
      <Table frame="bare" className="foulboard foulboard--teams">
        <colgroup>
          <col className="foulboard--teams__teamcol" />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className="team">Team</th>
            <th>Per game</th>
            {compare && <th>{compare.head}</th>}
            <th>Fouls</th>
            <th>With 2 Strikes</th>
            <th>% With 2 Strikes</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <tr key={t.id} {...favRowProps(t.id, favoriteTeamId)}>
              <td className="team">
                <span className="umprank__rank">{i + 1}</span>
                <TeamLogo teamId={t.id} name={teamAbbr({ id: t.id })} size={26} />
                <span className="sr-only">{teamFullName(t.id)}</span>
              </td>
              <td>{(t.fouls / t.g).toFixed(1)}</td>
              {compare && <td>{compare.cell(t)}</td>}
              <td>{t.fouls.toLocaleString('en-US')}</td>
              <td>{t.twoStrikeFouls.toLocaleString('en-US')}</td>
              <td>{t.fouls > 0 ? pct1(t.twoStrikeFouls / t.fouls) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </BoardCard>
  )
}
