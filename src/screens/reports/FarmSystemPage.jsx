import '../../styles/68-broadcast-reports.css'
import { useMemo, useState } from 'react'
import {
  fetchFarmSystem,
  farmBoard,
  correlate,
  PILLARS,
  WEIGHT_PRESETS,
  LEVEL_WEIGHTS,
} from '../../api/reports/farmSystem.js'
import { loadClubs, clubName, clubShort } from '../../api/reports/clubs.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { ReportMasthead, ReportSection } from '../../components/reports/ReportMasthead.jsx'
import { Slab, SlabRow } from '../../components/reports/StatSlab.jsx'
import { ClubCell } from '../../components/reports/ClubCell.jsx'
import { BarCell } from '../../components/reports/ReportBar.jsx'

// THE FARM REPORT — one number for how good an organisation's farm system is,
// and an honest account of what that number can and cannot see.
//
// The arithmetic, the research behind every weight, and the reasons the
// winning pillar is small all live in api/reports/farmSystem.js and
// docs/farm-index.md. This file is the presentation, and it has one editorial
// job the maths cannot do: make the reader aware that the ORDER OF THE LEAGUE
// IS A CHOICE. That is why the weight presets are a control on the page rather
// than a constant in a file — flipping from Balanced to Scoreboard reshuffles
// the top five, and a composite that hides that is selling a judgement as a
// measurement.
//
// The correlation line under the board is the same commitment in numbers: the
// published study that set the winning weight found R² ≈ 0.11 between farm
// rankings and affiliate winning, and the page RE-MEASURES that on the data in
// front of the reader rather than only citing it.
//
// SPOILER-FREE. Minor-league records and published prospect ranks are
// aggregates over completed games in another league (ADR-0034).

const pct3 = (n) => (n == null ? '—' : n.toFixed(3).replace(/^0/, ''))

// The three pillars as one stacked bar, each segment's width its own 0–100
// score scaled by its weight in the current preset — so the bar's total length
// IS the index and its composition shows where the index came from.
function PillarBar({ pillars, weights, label }) {
  // A pillar contributes (score × weight) points to a 100-point index — a
  // 0–100 score times a weight that sums to 1 — so that product IS the
  // percentage width it has earned on the bar. No further division: dividing
  // by 100 again drew every bar as a 0.6%-wide sliver.
  const parts = PILLARS.map((p) => ({
    key: p.key,
    width: pillars[p.key] * (weights[p.key] ?? 0),
  }))
  return (
    <span className="pillars" role="img" aria-label={label}>
      {parts.map((p) => (
        <span
          key={p.key}
          className={`pillars__seg pillars__seg--${p.key}`}
          style={{ width: `${p.width}%` }}
        />
      ))}
    </span>
  )
}

export function FarmSystemPage() {
  useDocumentTitle('The Farm Report')
  const [presetKey, setPresetKey] = useState('balanced')
  const [openOrg, setOpenOrg] = useState(null)
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchFarmSystem(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const preset = WEIGHT_PRESETS.find((p) => p.key === presetKey) ?? WEIGHT_PRESETS[0]
  const board = useMemo(() => (data ? farmBoard(data, preset.weights) : null), [data, preset])
  const rows = board ?? []
  const r2 = useMemo(() => correlate(rows), [rows])

  // The organisation the detail block is opened on: an explicit pick, else the
  // reader's own club if it is on the board, else the leader. Resolved ONCE so
  // the chip strip's pressed state and the block below it cannot disagree.
  const selected =
    rows.find((r) => r.orgId === (openOrg ?? favoriteTeamId)) ?? rows[0] ?? null
  const best = rows[0]
  const deepest = [...rows].sort((a, b) => b.prospects.length - a.prospects.length)[0]
  const winningest = [...rows].filter((r) => r.pct != null).sort((a, b) => b.pct - a.pct)[0]

  return (
    <div className="screen">
      <SiteHeader />

      <ReportMasthead
        eyebrow="The Farm Report"
        title="Farm System Index"
        dek="Thirty organisations, scored on the talent they hold, the games their affiliates
             win, and how young that talent is. The weights are a judgement, not a measurement —
             so they are a control on this page, and the board reorders when you change them."
        meta={[
          { label: 'Season', value: data?.season ?? '—' },
          { label: 'Ranked pool', value: data?.prospectPool ? `Top ${data.prospectPool}` : '—' },
          { label: 'Weighting', value: preset.label },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load the farm system data. Try again."
        emptyMessage="No farm system data on file yet."
        emptyProse
      />

      {rows.length > 0 && (
        <>
          <SlabRow>
            <Slab
              tone="lead"
              value={best ? best.index.toFixed(1) : '—'}
              label="Top system"
              note={best ? clubName(clubs, best.orgId) : ''}
            />
            <Slab
              value={deepest ? String(deepest.prospects.length) : '—'}
              label="Most ranked prospects"
              note={deepest ? clubName(clubs, deepest.orgId) : ''}
            />
            <Slab
              value={winningest ? pct3(winningest.pct) : '—'}
              label="Best system record"
              note={
                winningest
                  ? `${clubName(clubs, winningest.orgId)}, ${winningest.record.w}-${winningest.record.l} across four affiliates`
                  : ''
              }
            />
            <Slab
              value={r2 ? r2.r2.toFixed(2) : '—'}
              label="R² — talent vs. winning"
              note="Measured on the thirty rows below. Published studies land near 0.11; winning
                    is a weak proxy for talent, which is why it carries a quarter of the index."
            />
          </SlabRow>

          <ReportSection
            title="The board"
            note="Each bar is the index itself, split into the three pillars that made it. Change
                  the weighting and watch the order move — that movement is the honest content of
                  any composite ranking."
          >
            <div className="rpt-controls" role="group" aria-label="Weighting">
              {WEIGHT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`rpt-chip${p.key === presetKey ? ' is-on' : ''}`}
                  aria-pressed={p.key === presetKey}
                  onClick={() => setPresetKey(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <ul className="pillar-key">
              {PILLARS.map((p) => (
                <li key={p.key}>
                  <span className={`pillar-key__swatch pillar-key__swatch--${p.key}`} />
                  <span>
                    {p.label} — {Math.round((preset.weights[p.key] ?? 0) * 100)}%
                  </span>
                </li>
              ))}
            </ul>

            <div className="ledger-wrap">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Organisation</th>
                    <th>Index</th>
                    <th>Make-up</th>
                    <th>Top name</th>
                    <th>System record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.orgId} className={r.orgId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell
                        teamId={r.orgId}
                        name={clubShort(clubs, r.orgId)}
                        rank={r.rank}
                        tab="minors"
                        sub={`${r.prospects.length} ranked prospect${r.prospects.length === 1 ? '' : 's'}`}
                      />
                      <td>
                        <BarCell value={r.index} min={0} max={100}>
                          {r.index.toFixed(1)}
                        </BarCell>
                      </td>
                      <td>
                        <PillarBar
                          pillars={r.pillars}
                          weights={preset.weights}
                          label={`${clubName(clubs, r.orgId)} — talent ${r.pillars.capital}, winning ${r.pillars.production}, youth ${r.pillars.youth}`}
                        />
                      </td>
                      <td>
                        {r.topRank ? `#${r.topRank}` : '—'}
                        <span className="rpt__sub">
                          {r.prospects[0]?.name ?? 'None ranked'}
                        </span>
                      </td>
                      <td>
                        {r.record.w}-{r.record.l}
                        <span className="rpt__sub">{pct3(r.pct)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {r2 && (
              <p className="bcast-sec__note">
                Across these thirty organisations, the talent pillar and the winning pillar
                correlate at r = {r2.r.toFixed(2)} (R² = {r2.r2.toFixed(2)}). A club’s affiliates
                winning games tells you something about the talent in the system — but only
                something, which is the whole reason the two are separate columns instead of
                one number.
              </p>
            )}
          </ReportSection>

          <ReportSection
            title="Inside a system"
            note="Pick an organisation to see the four full-season clubs the index weighed and
                  every ranked name it holds."
          >
            <div className="rpt-controls" role="group" aria-label="Organisation">
              {rows.slice(0, 10).map((r) => (
                <button
                  key={r.orgId}
                  type="button"
                  className={`rpt-chip${r.orgId === selected?.orgId ? ' is-on' : ''}`}
                  aria-pressed={r.orgId === selected?.orgId}
                  onClick={() => setOpenOrg(r.orgId)}
                >
                  {clubs?.get(r.orgId)?.abbr || clubShort(clubs, r.orgId)}
                </button>
              ))}
            </div>
            <OrgDetail row={selected} clubs={clubs} />
          </ReportSection>

          <section className="method">
            <h2>How the index is built</h2>
            <p>
              <strong>The index runs from 0 to 100.</strong> It is not a rating of players and it
              is not in any real-world unit — it is a club’s standing among these thirty clubs,
              this season, on three things added together. Each of the three is scored 0 to 100
              across the league first, then weighted, so the leader’s 100 means “furthest ahead
              of the field here” rather than “perfect”.
            </p>
            <p>
              <strong>Talent is 60 per cent.</strong> It adds up a value curve over every ranked
              prospect the organisation holds — an exponential curve, not a straight line,
              because prospect value is not linear in rank. Public valuation work puts a top-five
              name near $150–200 million of surplus value and a fortieth-percentile name near $16
              million, which makes the No. 1 prospect in baseball worth roughly twelve No. 100s.
              A system of six names ranked in the nineties is not a better system than one holding
              the best player in the minors, and this curve is what stops the board saying
              otherwise.
            </p>
            <p>
              <strong>Winning is 25 per cent.</strong> It is the four full-season affiliates’
              records, weighted by how close each level is to the majors — Triple-A at{' '}
              {Math.round(LEVEL_WEIGHTS[11] * 100)} per cent down to Single-A at{' '}
              {Math.round(LEVEL_WEIGHTS[14] * 100)} per cent, because a Triple-A club is one
              phone call from the big league roster and a Single-A club is three years away. It
              is only a quarter of the index on purpose. The one published attempt to regress
              farm-system rankings against system-wide minor-league winning found an R² of about
              0.11: affiliate rosters carry organisational filler and repeat-level veterans, and a
              club that promotes aggressively strips its own Triple-A team of the players who made
              it good. Winning is evidence, and it is weak evidence.
            </p>
            <p>
              <strong>Youth is 15 per cent.</strong> It is the value-weighted average age of those
              ranked names, measured against a pivot of 21. It is runway, not readiness — a
              nineteen-year-old at Double-A has more development left than a twenty-four-year-old
              at the same rank, and also has further to walk before he helps anyone. It is the
              smallest pillar because it modifies talent that has already been counted rather
              than adding any of its own.
            </p>
            <p>
              <strong>What it cannot see.</strong> It reads ordinal ranks, not tools. It has no
              view of depth below the published top {data?.prospectPool ?? 100}, of an
              international class just signed, of the arm that blew out in June, or of a club’s
              record at actually developing the players it drafts — which is the question most
              people are really asking. It is a snapshot of held assets and recent results, and it
              is worth exactly that. Because every pillar is rescaled across the thirty
              organisations before the weights are applied, a score describes a position in this
              league in this season and never carries between seasons.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}

// One organisation, opened up. TWO tables, not one: the affiliates and the
// prospects share no columns at all (a record and a level against a rank and an
// age), and stacking them under one header row printed an age under a heading
// that said "Pct".
function OrgDetail({ row, clubs }) {
  if (!row) return null
  return (
    <>
      <div className="ledger-wrap">
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">{clubName(clubs, row.orgId)} — affiliates</th>
              <th>Level</th>
              <th>Record</th>
              <th>Pct</th>
            </tr>
          </thead>
          <tbody>
            {row.affiliates.map((a) => (
              <tr key={a.id}>
                <td className="team">{a.name}</td>
                <td>{a.level}</td>
                <td>{a.w == null ? '—' : `${a.w}-${a.l}`}</td>
                <td>{a.w == null || a.w + a.l === 0 ? '—' : pct3(a.w / (a.w + a.l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ledger-wrap">
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">Ranked prospects</th>
              <th>Pos</th>
              <th>Rank</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {row.prospects.length === 0 ? (
              <tr>
                <td className="team">None inside the published list</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
              </tr>
            ) : (
              row.prospects.map((p) => (
                <tr key={p.playerId}>
                  <td className="team">
                    <PlayerLink id={p.playerId}>{p.name}</PlayerLink>
                  </td>
                  <td>{p.position}</td>
                  <td>#{p.rank}</td>
                  <td>{p.age ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
