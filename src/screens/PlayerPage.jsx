import { fetchPerson, fetchPersonStats } from '../api/mlb.js'
import {
  personBio,
  personSportId,
  aggregateSplits,
  pitcherRole,
  buildBlock,
} from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { LinkScope } from '../lib/nav.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLink } from '../components/TeamLink.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}
function debutLabel(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}
function draftLabel(draft) {
  if (!draft || !draft.year) return DASH
  if (!draft.round) return String(draft.year)
  return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
}

// Assemble the full player view — bio + one stat block (two for a two-way
// player). Stats are cut off at the day BEFORE the game date ("entering today")
// when reached from a game (`asOf` set); a bare link defaults to current stats.
async function loadPlayer(id, asOf) {
  const person = await fetchPerson(id)
  if (!person) return null
  const bio = personBio(person)
  const sportId = personSportId(person)
  const season = Number((asOf || isoToday()).slice(0, 4))
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const cutoff = asOf || null
  const groups = bio.twoWay
    ? ['hitting', 'pitching']
    : [bio.isPitcher ? 'pitching' : 'hitting']

  const blocks = await Promise.all(
    groups.map(async (group) => {
      const [seasonSplits, careerSplits, lrSplits, gameLogSplits, yearByYearSplits] =
        await Promise.all([
          fetchPersonStats(id, {
            type: 'byDateRange', group, season,
            startDate: `${season}-01-01`, endDate, sportId,
          }),
          fetchPersonStats(id, { type: 'career', group, sportId }),
          fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId }),
          fetchPersonStats(id, { type: 'gameLog', group, season, sportId }),
          fetchPersonStats(id, { type: 'yearByYear', group, sportId }),
        ])
      const seasonStat = aggregateSplits(seasonSplits, group)
      const role = group === 'pitching' ? pitcherRole(seasonStat) : null
      return buildBlock({
        group, role, seasonSplits, careerSplits, lrSplits,
        gameLogSplits, yearByYearSplits, cutoff, currentSeason: season,
      })
    }),
  )

  return { bio, blocks, season, asOf, sportId }
}

export function PlayerPage({ id, asOf, sportId }) {
  const { loading, error, data } = useAsync(() => loadPlayer(id, asOf), [id, asOf])

  const back = () => window.history.back()

  if (loading && !data) {
    return (
      <div className="screen player">
        <BackBtn onClick={back} />
        <p className="hint">Loading player…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen player">
        <BackBtn onClick={back} />
        <p className="hint hint--error">
          {error ? 'Couldn’t load this player. Try again.' : 'Player not found.'}
        </p>
      </div>
    )
  }

  const { bio, blocks } = data
  const pitchBlock = blocks.find((b) => b.group === 'pitching')
  const heroPos = (bio.isPitcher && pitchBlock?.role) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen player">
        <BackBtn onClick={back} />

        <header className="player__hero">
          <Headshot personId={bio.id} name={bio.fullName} />
          <div className="player__ident">
            <h1 className="player__name">
              {bio.fullName}
              {bio.number && <span className="player__num">#{bio.number}</span>}
            </h1>
            <p className="player__meta">
              {heroPos && <span className="player__pos">{heroPos}</span>}
              {hand && <> <span className="sep">·</span> {hand}</>}
              {bio.team && (
                <> <span className="sep">·</span>{' '}
                  <TeamLink id={bio.team.id} className="player__team">{bio.team.name}</TeamLink>
                </>
              )}
            </p>
          </div>
        </header>

        <div className="factgrid">
          <Fact label="Ht / Wt" value={bio.heightWeight} />
          <Fact label="Age" value={bio.age} mono />
          <Fact label="Born" value={bio.born} />
          <Fact label="MLB Debut" value={debutLabel(bio.debut) || DASH} />
          <Fact label="Bats / Throws" value={`${bio.bats || DASH} / ${bio.throws || DASH}`} />
          <Fact label="Draft" value={draftLabel(bio.draft)} />
        </div>

        {blocks.map((block) => (
          <section key={block.group}>
            {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

            <SectionTitle title={`Season ${data.season}`} note={
              block.group === 'pitching' && block.role ? `${roleWord(block.role)} · ${enteringLabel}` : enteringLabel
            } />
            <div className="player__statgrid">
              {block.tiles.map((t) => (
                <div key={t.k} className={`stat${t.tone === 'run' ? ' stat--run' : ''}`}>
                  <div className="stat__v">{t.v}</div>
                  <div className="stat__k">{t.k}</div>
                </div>
              ))}
            </div>

            {block.careerLine && (
              <>
                <SectionTitle title="Career" />
                <p className="player__career">{block.careerLine}</p>
              </>
            )}

            {block.gameLog && (
              <>
                <SectionTitle title="Game log" note={`last ${block.gameLog.rows.length} · entering today`} />
                <Ledger
                  head={['Date', 'Opp', ...block.gameLog.columns]}
                  rows={block.gameLog.rows.map((r) => ({
                    key: r.date,
                    cells: [r.date, `${r.home ? 'vs' : '@'} ${r.opp}`, ...r.cells],
                  }))}
                />
              </>
            )}

            {block.yearByYear && (
              <>
                <SectionTitle title="Year by year" />
                <Ledger
                  leftCols={1}
                  head={['Year', ...block.yearByYear.columns]}
                  rows={block.yearByYear.rows.map((r) => ({
                    key: r.year,
                    current: r.isCurrent,
                    cells: [`${r.year}${r.isCurrent ? '*' : ''}`, ...r.cells],
                  }))}
                />
              </>
            )}

            {block.splits && (
              <>
                <SectionTitle title="Season splits" note={block.splitsLabel} />
                <div className="player__splits">
                  <SplitCard label={block.group === 'pitching' ? 'vs LHB' : 'vs LHP'} side={block.splits.left} />
                  <SplitCard label={block.group === 'pitching' ? 'vs RHB' : 'vs RHP'} side={block.splits.right} />
                </div>
              </>
            )}
          </section>
        ))}

        <p className="hint player__caveat">
          {asOf
            ? 'Season tiles, game log and past-year rows are frozen to “entering today.” The current-year row and the splits are full-season figures.'
            : 'Current-season figures (no game context).'}
        </p>
      </div>
    </LinkScope>
  )
}

function roleWord(role) {
  return role === 'SP' ? 'starter' : role === 'CL' ? 'closer' : 'reliever'
}

function BackBtn({ onClick }) {
  return (
    <button type="button" className="backbtn" onClick={onClick}>
      ‹ back
    </button>
  )
}

function SectionTitle({ title, note }) {
  return (
    <h3 className="section__title">
      <span>{title}</span>
      {note && <em>{note}</em>}
    </h3>
  )
}

function Fact({ label, value, mono = false }) {
  return (
    <div className="fact">
      <div className="fact__label">{label}</div>
      <div className={`fact__value${value === DASH ? ' fact__na' : ''}`}>
        {mono ? <span className="mono">{value}</span> : value}
      </div>
    </div>
  )
}

function SplitCard({ label, side }) {
  return (
    <div className="split">
      <div className="split__k">{label}</div>
      <div className="split__row">
        <span className="split__v">{side.avg}</span>
        <span className="split__sub">{side.ops} OPS</span>
      </div>
    </div>
  )
}

function Ledger({ head, rows }) {
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i < 2 ? 'lft' : ''}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.current ? 'is-current' : ''}>
              {r.cells.map((c, i) => (
                <td key={i} className={i === 0 ? 'lft yr' : i === 1 ? 'lft opp' : ''}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
