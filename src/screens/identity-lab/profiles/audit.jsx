/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, not the components inside it; the
   components are local by design. Fast Refresh falls back to a full reload for
   this dev-only lab, which is a fine trade for keeping each dimension's data,
   copy text, and tiles in one readable file. */
import { useEffect, useState } from 'react'
import { ALL_MLB_TEAM_IDS, teamClubName, teamFullName, teamLogoUrl, treatmentTile } from '../../../lib/teams.js'
import {
  JERSEY_TREATMENT_OVERRIDES,
  classifyUniformAsset,
  fetchTeamUniformCatalog,
  jerseyLabel,
} from '../../../api/uniforms.js'
import { ClubRail } from '../ClubRail.jsx'
import { teamAnchorId } from '../teamAnchorId.js'

// The jersey audit: one row per (club, catalog jersey) — see PRD §"PR 2" —
// answering "which mark does this jersey actually resolve to, and did that
// come from a hand-curated override or classifyUniformAsset's naming guess."
// Built BEFORE any further art/color investment (logo upload, MiLB colors)
// because a wrong mapping found here changes what that work should target.
// Read-only: unlike the color dimensions, this tab edits nothing and writes no
// draft — it surfaces what production (treatmentTile, the same resolver the
// slate card and in-game masthead call) already renders for a jersey.
const TREATMENT_LABEL = {
  main: 'Main',
  alternate: 'Alternate',
  'alternate-2': 'Alternate 2',
  'alternate-3': 'Alternate 3',
  'alternate-4': 'Alternate 4',
  'city-connect': 'City Connect',
}

// classifyUniformAsset checks JERSEY_TREATMENT_OVERRIDES by uniformAssetCode
// first — this mirrors that same check so the audit reports the identical
// answer classifyUniformAsset would give, not a second guess at it.
function resolvedVia(code) {
  return code && JERSEY_TREATMENT_OVERRIDES[code] ? 'override' : 'heuristic'
}

// All 69 current JERSEY_TREATMENT_OVERRIDES keys embed the season
// ('110_jersey_1_2026') — PRD §1.5's latent bug: at the next season's
// rollover every key goes stale at once and silently falls back to the
// heuristic, league-wide, with no error. Counted from the static table, not
// the fetched catalog, so this reads true even before a catalog call
// resolves.
function seasonStaleness() {
  const season = String(new Date().getFullYear())
  const keys = Object.keys(JERSEY_TREATMENT_OVERRIDES)
  const current = keys.filter((k) => k.endsWith(`_${season}`)).length
  return { season, total: keys.length, current, stale: keys.length - current }
}

function useMlbUniformCatalog() {
  const [catalog, setCatalog] = useState(null) // null while loading
  useEffect(() => {
    let cancelled = false
    fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear()).then((data) => {
      if (!cancelled) setCatalog(data)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return catalog
}

// One row per catalog jersey asset, sorted by club then the catalog's own
// order (already piece-then-club order from the feed). `treatment` and `via`
// are exactly what classifyUniformAsset/JERSEY_TREATMENT_OVERRIDES would give
// a real game-card render for this same code — see gen-jerseys.mjs, the
// nightly precompute that calls the identical function.
function buildRows(catalog) {
  const teamIds = [...ALL_MLB_TEAM_IDS].sort((a, b) => teamFullName(a).localeCompare(teamFullName(b)))
  const rows = []
  for (const teamId of teamIds) {
    const assets = catalog[teamId]
    if (!assets) continue
    const clubName = teamClubName(teamId)
    for (const a of assets) {
      if (a.piece !== 'J') continue
      rows.push({
        teamId,
        teamName: teamFullName(teamId),
        code: a.code,
        text: a.text,
        label: jerseyLabel(a.text, clubName),
        treatment: classifyUniformAsset(a.text, clubName, a.code),
        via: resolvedVia(a.code),
      })
    }
  }
  return rows
}

// The exact tile production renders for this (team, treatment) —
// `treatmentTile` is the same resolver GameCard/GameView call, not the color
// lab's own editable draft-preview math — so a mismatch here is a mismatch a
// real user would actually see. `teamLogoUrl` resolves the same logoVariant
// it returns; comparing that URL against the plain base logo tells apart "no
// curated art needed, this treatment intentionally shares the Main mark"
// (PRD §1.6, e.g. alternate-4) from "curated art is expected here and
// missing," which only an actual failed image load can confirm.
function AuditTile({ teamId, treatment }) {
  const tile = treatmentTile(teamId, treatment)
  const url = teamLogoUrl(teamId, tile.logoVariant)
  const baseUrl = teamLogoUrl(teamId, 'base')
  const sharesMainArt = treatment !== 'main' && url === baseUrl
  const [failed, setFailed] = useState(false)
  // Reset computed during render, not in an effect — see Headshot.jsx.
  const [prevUrl, setPrevUrl] = useState(url)
  if (url !== prevUrl) {
    setPrevUrl(url)
    setFailed(false)
  }

  const style = {
    '--tint': tile.pinstripeColor ? undefined : tile.tint,
    '--scale': 1.32 * tile.scale,
    '--pinstripe-color': tile.pinstripeColor ?? undefined,
    '--pinstripe-bg': tile.pinstripeBg ?? undefined,
  }

  let artStatus
  if (treatment === 'main' && tile.logoVariant === 'base') artStatus = 'CDN mark'
  else if (sharesMainArt) artStatus = 'Shares Main art (by design)'
  else if (failed) artStatus = 'Missing'
  else artStatus = 'Curated'

  return (
    <div className="audittile">
      <div
        className={`colorlab__logobox colorlab__logobox--gloss${tile.pinstripeColor ? ' colorlab__logobox--pinstripe' : ''}`}
        style={style}
      >
        {url && !failed ? (
          // Eager, not lazy — this table's whole point is an accurate art
          // status per row, and a lazy image below the fold hasn't attempted
          // its fetch yet, which would read as "Curated" (failed still false)
          // until scrolled into view. A few hundred eager loads is an
          // acceptable cost for a dev-only, unlisted audit page.
          <img
            key={url}
            src={url}
            alt=""
            className="colorlab__logoimg"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="colorlab__logoplaceholder" aria-hidden="true">
            <span>No logo yet</span>
          </div>
        )}
      </div>
      <span className={`audittile__art${artStatus === 'Missing' ? ' audittile__art--error' : ''}`}>
        {artStatus}
      </span>
    </div>
  )
}

function AuditRow({ row, isFirstForTeam, striped }) {
  return (
    <tr
      className={`audittable__row${striped ? ' audittable__row--alt' : ''}`}
      id={isFirstForTeam ? teamAnchorId(row.teamId) : undefined}
    >
      <td className="audittable__team">{row.teamName}</td>
      <td>
        <div className="audittable__raw">
          <span className="audittable__rawtext">{row.text}</span>
          <span className="audittable__rawcode">{row.code ?? '—'}</span>
        </div>
      </td>
      <td>{row.label}</td>
      <td>{TREATMENT_LABEL[row.treatment] ?? row.treatment}</td>
      <td>
        <span className={`audittable__via audittable__via--${row.via}`}>
          {row.via === 'override' ? 'Override' : 'Heuristic'}
        </span>
      </td>
      <td>
        <AuditTile teamId={row.teamId} treatment={row.treatment} />
      </td>
    </tr>
  )
}

// Every club in row order, deduped — the jump nav's target list. Built from
// the FULL row set (not the heuristic-only filtered view) so the sidebar
// never reshuffles or drops a logo when the checkbox is toggled; a club
// filtered down to zero visible rows just has no matching anchor to land on.
function navTeamsFromRows(rows) {
  const seen = new Set()
  const teams = []
  for (const row of rows) {
    if (seen.has(row.teamId)) continue
    seen.add(row.teamId)
    teams.push({ id: row.teamId, name: row.teamName })
  }
  return teams
}

// Tags each row with whether it's the first for its club (carries the anchor
// id the jump nav targets) and which side of the zebra stripe it falls on —
// computed over whatever's actually rendering, so a club's stripe/anchor
// follow it correctly whether the heuristic-only filter is on or off.
function withTeamMeta(rows) {
  const seen = new Set()
  let alt = false
  return rows.map((row) => {
    const isFirstForTeam = !seen.has(row.teamId)
    if (isFirstForTeam) {
      seen.add(row.teamId)
      alt = !alt
    }
    return { row, isFirstForTeam, striped: alt }
  })
}

function AuditLabBody() {
  const catalog = useMlbUniformCatalog()
  const [heuristicOnly, setHeuristicOnly] = useState(false)
  const staleness = seasonStaleness()

  if (catalog === null) return <p className="hint">Loading uniform catalog…</p>

  const rows = buildRows(catalog)
  const overrideCount = rows.filter((r) => r.via === 'override').length
  const heuristicCount = rows.length - overrideCount
  const visible = heuristicOnly ? rows.filter((r) => r.via === 'heuristic') : rows
  const navTeams = navTeamsFromRows(rows)
  const visibleWithMeta = withTeamMeta(visible)

  return (
    <>
      {/* No club selection to make here — the audit is a full-list table by
          design — so the rail stays what this page's sidebar always was: a
          list of anchors into the rows. */}
      <ClubRail teams={navTeams} />

      <div className={`audit__banner${staleness.stale > 0 ? ' audit__banner--warn' : ''}`}>
        <strong>{staleness.current}</strong> of <strong>{staleness.total}</strong>{' '}
        <code>JERSEY_TREATMENT_OVERRIDES</code> keys match season {staleness.season}
        {staleness.stale > 0 ? (
          <>
            {' '}
            — <strong>{staleness.stale}</strong> stale and silently falling back to the heuristic.
          </>
        ) : (
          <>. None stale yet — every key still rolls over together at the next season boundary.</>
        )}
      </div>

      <p className="hint">
        {rows.length} catalog jerseys across {ALL_MLB_TEAM_IDS.length} clubs: {overrideCount} resolve via a
        curated <code>JERSEY_TREATMENT_OVERRIDES</code> entry, {heuristicCount} via{' '}
        <code>classifyUniformAsset</code>&apos;s naming heuristic — an unaudited row where a misapplication is
        most likely to hide.
      </p>

      <label className="audit__filter">
        <input
          type="checkbox"
          checked={heuristicOnly}
          onChange={(e) => setHeuristicOnly(e.target.checked)}
        />
        <span>Heuristic only ({heuristicCount})</span>
      </label>

      <div className="audittable__scroll">
        <table className="audittable">
          <thead>
            <tr>
              <th>Team</th>
              <th>Raw asset (text / code)</th>
              <th>Jersey label</th>
              <th>Resolved treatment</th>
              <th>Resolved via</th>
              <th>Rendered tile</th>
            </tr>
          </thead>
          <tbody>
            {visibleWithMeta.map(({ row, isFirstForTeam, striped }) => (
              <AuditRow
                key={`${row.teamId}:${row.code ?? row.text}`}
                row={row}
                isFirstForTeam={isFirstForTeam}
                striped={striped}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export const auditProfile = {
  key: 'audit',
  label: 'Jersey audit',
  chrome: 'jump',
  title: 'Team Identity Lab — Jersey audit',
  hint: (
    <>
      An unlisted, dev-only design harness — not linked anywhere in the app. One row per catalog jersey:
      the raw <code>uniformAssetText</code>/<code>uniformAssetCode</code>, which logo treatment it
      resolves to, whether that came from a hand-curated <code>JERSEY_TREATMENT_OVERRIDES</code> entry or{' '}
      <code>classifyUniformAsset</code>&apos;s naming heuristic, and the tile that treatment actually renders in
      the real app (via <code>treatmentTile</code>) — so a mismatch between the jersey&apos;s name and its
      rendered mark is visible at a glance. Read-only: nothing here edits a store.
    </>
  ),
  Body: AuditLabBody,
}
