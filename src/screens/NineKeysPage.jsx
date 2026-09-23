import '../styles/79-nine-keys.css'
import { floorSentence, loadNineKeys, placeboSentence, supportSentence } from '../api/nineKeys.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { ordinal } from '../lib/format.js'

// Nine Keys (/nine-keys) — a Lichtman-style screen pointed at a baseball
// season. Nine true-or-false keys, each asking whether a club finished in the
// top half of the league on one measure, and one rule fitted to the
// champions: no World Series winner since 2000 has failed more than three.
//
// The page REPORTS; it does not argue. Every number on it comes out of
// public/data/nine-keys.json, including the threshold table, the outcome
// ladder and the validation figures — none of it is written into this file,
// so a regenerate can never leave prose contradicting the data. The sentences
// that read the figures (who sits at the limit, how much it rests on one
// season, the placebo) are built from the file by helpers in
// src/api/nineKeys.js, where the tests check them for every count.
//
// The same grid draws twice, for the clubs holding a place now and for every
// champion since 2000, so the two are read the same way.

const RUNG_LABEL = {
  0: 'Missed October',
  1: 'Lost its first series',
  2: 'Won a round, no LCS',
  3: 'Lost the LCS',
  4: 'Lost the World Series',
  5: 'Won the World Series',
}

function KeyGlyph({ broken }) {
  return (
    <svg className="ninekeys__keyglyph" viewBox="0 0 26 18" aria-hidden="true" focusable="false">
      <circle className="ninekeys__kline" cx="6.5" cy="9" r="4.4" />
      <path className="ninekeys__kline" d="M11 9 H23 M18.5 9 V13 M22 9 V12.2" />
      {broken && <path className="ninekeys__kcut" d="M2 15.5 L24 2.5" />}
    </svg>
  )
}

// One club, one season: a rank in every key's column, then the tally.
function GridRow({ row, keys, bar, limit, lead, meta, floor }) {
  const failed = row.failed?.length ?? 0
  const out = failed > limit
  const className = [
    floor ? 'ninekeys__row--floor' : '',
    failed === 0 ? 'ninekeys__row--clean' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <tr className={className || undefined}>
      <th scope="row" className="ninekeys__club">
        <TeamLogo teamId={row.teamId} name={row.name} size={24} className="ninekeys__logo" />
        <span className="ninekeys__clubtext">
          <span className="ninekeys__clubname">{lead}</span>
          <span className="ninekeys__clubmeta">{meta}</span>
        </span>
      </th>
      {keys.map((key) => {
        const rank = row.ranks?.[key.id]
        const fails = rank == null || rank > bar
        return (
          <td
            key={key.id}
            className={`ninekeys__cell${fails ? ' ninekeys__cell--fail' : ''}`}
          >
            <span className="ninekeys__mark">
              {rank == null ? (
                '—'
              ) : (
                <>
                  {rank}
                  <sup className="ninekeys__ord">{ordinal(rank).slice(String(rank).length)}</sup>
                </>
              )}
            </span>
          </td>
        )
      })}
      <td
        className={`ninekeys__tally${out ? ' ninekeys__tally--out' : failed === 0 ? ' ninekeys__tally--clean' : ''}`}
      >
        <span className="ninekeys__tallyn">{failed}</span>
        <KeyGlyph broken={out} />
        <span className="sr-only">{out ? 'breaks the rule' : 'within the rule'}</span>
      </td>
    </tr>
  )
}

function KeyGrid({ caption, keys, children }) {
  return (
    <div className="ninekeys__scroller">
      <table className="ninekeys__grid">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Club</th>
            {keys.map((key) => (
              <th key={key.id} scope="col">
                {key.label}
              </th>
            ))}
            <th scope="col">Failed</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Legend() {
  return (
    <div className="ninekeys__legend">
      <span>
        <i className="ninekeys__swatch" /> passed
      </span>
      <span>
        <i className="ninekeys__swatch ninekeys__swatch--fail" /> failed
      </span>
      <span>
        <KeyGlyph broken={false} /> within the rule
      </span>
      <span>
        <KeyGlyph broken /> breaks it
      </span>
    </div>
  )
}

export function NineKeysPage() {
  useDocumentTitle('Nine Keys')
  const { loading, error, data, reload } = useAsync(() => loadNineKeys(), [])

  const keys = data?.keys ?? []
  const champions = data?.champions ?? []
  const current = data?.current ?? null
  const bar = data?.bar ?? 15
  const limit = data?.limit ?? 3
  const keyLabel = (id) => keys.find((k) => k.id === id)?.label ?? id
  const hasData = champions.length > 0

  const ladderMax = (data?.ladder ?? []).reduce((m, r) => Math.max(m, r.meanFailed), 0) || 1
  const atLimit = floorSentence(champions, limit, keyLabel)
  const support = supportSentence(data?.limitSupport, limit, champions)
  const placebo = placeboSentence(data?.placebo)

  return (
    <div className="screen">
      <SiteHeader />

      <h1 className="topbar__title">Nine Keys</h1>
      <p className="ninekeys__intro">
        Allan Lichtman predicts presidencies with thirteen true-or-false keys and one rule: the
        party in power loses if six come up false. The same structure, pointed at a baseball
        season.
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasData}
        errorMessage="Couldn’t load the Nine Keys report. Try again."
        emptyMessage="No report yet."
        onRetry={reload}
      />

      {hasData && (
        <>
          <p className="ninekeys__rule">
            <span>No champion since {data.firstSeason} has failed more than</span>
            <span className="ninekeys__count">
              {limit} of {keys.length}
            </span>
          </p>
          <p className="ninekeys__intro">
            Each key asks the same question of a different measure: did this club finish in the top{' '}
            {bar} of all 30, that season? Rank {bar + 1} or worse fails the key. One number was
            fitted to the champions — the {limit}.
          </p>

          <section className="ninekeys__section">
            <h2 className="ninekeys__h">What each key asks</h2>
            <dl className="ninekeys__keys">
              {keys.map((key) => (
                <div className="ninekeys__key" key={key.id}>
                  <dt>{key.label}</dt>
                  <dd>{key.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          {current && current.teams.length > 0 && (
            <section className="ninekeys__section">
              <h2 className="ninekeys__h">The {current.season} field</h2>
              <p className="ninekeys__note">
                {current.complete
                  ? 'Final regular-season ranks for the clubs that made the postseason.'
                  : 'Clubs holding a postseason place as the standings stand. Ranks move until the regular season ends.'}
              </p>
              <KeyGrid caption={`The ${current.season} postseason field scored against nine keys`} keys={keys}>
                {current.teams.map((team) => (
                  <GridRow
                    key={team.teamId}
                    row={team}
                    keys={keys}
                    bar={bar}
                    limit={limit}
                    lead={
                      <TeamLink id={team.teamId} name={team.name}>
                        {team.name}
                      </TeamLink>
                    }
                    meta={`${team.wins}–${team.losses}`}
                  />
                ))}
              </KeyGrid>
              <Legend />
            </section>
          )}

          <section className="ninekeys__section">
            <h2 className="ninekeys__h">Every champion since {data.firstSeason}</h2>
            <p className="ninekeys__note">
              The same nine ranks for each World Series winner, most recent first.
              {atLimit ? ` ${atLimit}` : ''}
            </p>
            <KeyGrid caption="Every World Series champion scored against nine keys" keys={keys}>
              {champions.map((champion) => (
                <GridRow
                  key={champion.year}
                  row={champion}
                  keys={keys}
                  bar={bar}
                  limit={limit}
                  floor={(champion.failed?.length ?? 0) === limit}
                  lead={
                    <TeamLink id={champion.teamId} name={champion.name}>
                      {champion.name}
                    </TeamLink>
                  }
                  meta={`${champion.year} · ${champion.wins}–${champion.losses}${champion.shortSeason ? ' · 60 games' : ''}`}
                />
              ))}
            </KeyGrid>
            <Legend />
          </section>

          {data.thresholds.length > 0 && (
            <section className="ninekeys__section">
              <h2 className="ninekeys__h">What a stricter line would cost</h2>
              <div className="ninekeys__rows">
                {data.thresholds
                  .filter((t) => t.limit >= 1 && t.limit <= limit)
                  .map((t) => (
                    <div
                      className={`ninekeys__row${t.limit === limit ? ' ninekeys__row--em' : ''}`}
                      key={t.limit}
                    >
                      <span className="ninekeys__rowlabel">Fail no more than {t.limit}</span>
                      <span className="ninekeys__rowval">
                        {t.championsPassing} of {t.championTotal}
                      </span>
                      <span className="ninekeys__rownote">
                        rejects {t.rejectsOctober}% of the field
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {data.ladder.length > 0 && (
            <section className="ninekeys__section">
              <h2 className="ninekeys__h">Keys failed, by how far a club got</h2>
              <p className="ninekeys__note">
                Every club, every season. Nothing in the rule was fitted to any outcome except
                winning the World Series.
              </p>
              <div className="ninekeys__rows">
                {data.ladder.map((rung) => (
                  <div
                    className={`ninekeys__rung${rung.rung === 5 ? ' ninekeys__rung--win' : ''}`}
                    key={rung.rung}
                  >
                    <span className="ninekeys__runglabel">{RUNG_LABEL[rung.rung] ?? rung.rung}</span>
                    <span className="ninekeys__rungbar">
                      <i style={{ width: `${(100 * rung.meanFailed) / ladderMax}%` }} />
                    </span>
                    <span className="ninekeys__rungn">{rung.meanFailed.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="ninekeys__method">
            <p>
              Each measure is scored as a rank within its own season, so a run environment that
              moves between {data.firstSeason} and now cannot move a key. Equal values take the
              better rank. Ranks come from the MLB Stats API. Who played in October comes from this
              site’s own postseason history; for a season that history does not have yet, it comes
              from the clubs the final standings mark as clinched.
            </p>
            {(support || placebo) && <p>{[support, placebo].filter(Boolean).join(' ')}</p>}
          </div>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
