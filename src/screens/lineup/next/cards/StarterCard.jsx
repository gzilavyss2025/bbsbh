import { prospectBadge } from '../../../../api/prospects.js'
import { showRookiePill, hasDebuted } from '../../../../api/rookies.js'
import { milestoneTextFor } from '../../../../api/callouts.js'
import { splitDisplayName } from '../../../../api/person.js'
import { vsTeamDoorLabel } from '../../../../api/vsTeamSplits.js'
import { BoxLinesDoor } from '../../../../components/boxlines/BoxLinesDoor.jsx'
import { DebutPill } from '../../../../components/badges/DebutPill.jsx'
import { MilestonePill } from '../../../../components/badges/MilestonePill.jsx'
import { ProspectPill } from '../../../../components/badges/ProspectPill.jsx'
import { RookiePill } from '../../../../components/badges/RookiePill.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { StarterMix } from '../../../../components/playbyplay/pitcherCard/StarterMix.jsx'
import { ProjectedStarters } from '../../../../components/workload/ProjectedStarters.jsx'
import { EmptyState } from '../../../../components/ui/state/EmptyState.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { headerThemeClass, headerThemeStyle } from '../../../../lib/headerTheme.js'
import { lastGameLine, seasonVsOpponentLine } from '../../../TeamInfo.jsx'
import { ClubBar } from './ClubBar.jsx'

// One line of the card's strips: a small label, then the line.
function StripRow({ label, children }) {
  return (
    <p className="lsp__row">
      <span className="lsp__rowlabel">{label}</span>
      <span className="lsp__rowtext">{children}</span>
    </p>
  )
}

// The four season figures, as a row of cells; the first (ERA) is the ink lead.
function SeasonCells({ line }) {
  const cells = [
    ['ERA', line.era],
    ['W–L', line.wins != null ? `${line.wins}–${line.losses}` : null],
    ['K', line.strikeOuts],
    ['IP', line.inningsPitched],
  ]
  return (
    <dl className="lsp__cells">
      {cells.map(([label, value], i) => (
        <div key={label} className={`lsp__cell${i === 0 ? ' lsp__cell--lead' : ''}`}>
          <dt className="lsp__celllabel">{label}</dt>
          <dd className="lsp__cellvalue">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

// The starter this club's lineup is about to face, on the OTHER club's colours (the club
// whose arm it is), as the live page does. Season figures, his last start and his line
// against this club all end the day before the game (ADR-0088); his pitch mix is a season
// total of finished games. A played game or a forfeit with no starter says so in one line.
export function StarterCard({ data, theme, masthead }) {
  const { oppPitcher: pitcher, oppMeta, meta, season, isMlb, closed, projectedStarters, oppPitcherLine: line } = data
  const ink = headerThemeClass(theme)
  return (
    <Card
      frame="stamped"
      body="flush"
      className={`lsp ${ink}`.trim()}
      style={headerThemeStyle(theme, masthead.scale)}
      head={<ClubBar title="Starting pitcher" teamId={oppMeta.id} teamName={oppMeta.teamName} masthead={masthead} season={season} />}
    >
      {pitcher ? (
        <>
          <div className="lsp__who">
            <Headshot personId={pitcher.id} name={pitcher.name} teamId={oppMeta.id} className="lsp__shot" />
            <div className="lsp__id">
              <PlayerLink id={pitcher.id} className="lsp__name">
                {pitcher.nameLastFirst}
              </PlayerLink>
              <span className="lsp__meta">
                {pitcher.hand && <span className="lsp__hand">{pitcher.hand}HP</span>}
                {pitcher.jersey && <span className="lsp__jersey">{pitcher.jersey}</span>}
              </span>
              <span className="lsp__pills">
                <ProspectPill {...prospectBadge(data.prospectsData, pitcher.id, data.oppOrgTeamId)} />
                <MilestonePill text={milestoneTextFor(data.callouts, pitcher.id)} />
                <RookiePill active={showRookiePill(data.rookiesData, pitcher.id, isMlb)} />
                <DebutPill debuted={!isMlb && hasDebuted(data.rookiesData, pitcher.id)} />
              </span>
            </div>
          </div>
          {line && <SeasonCells line={line} />}
          <div className="lsp__rows">
            {line?.lastGame && <StripRow label="Last start">{lastGameLine(line.lastGame)}</StripRow>}
            {line?.vsOpponent && <StripRow label="This year">{seasonVsOpponentLine(line.vsOpponent, data.vsOpponentAbbr)}</StripRow>}
            {data.careerVsOpp && (
              <BoxLinesDoor
                className="lsp__career"
                label={vsTeamDoorLabel(data.careerVsOpp, 'pitching', data.vsOpponentAbbr)}
                sheet={{
                  personId: pitcher.id,
                  playerSurname: splitDisplayName(pitcher.name).last,
                  group: 'pitching',
                  opponentId: meta.id,
                  opponentName: meta.teamName || meta.name,
                  cutoff: data.info.officialDate ?? null,
                }}
              />
            )}
          </div>
          {data.arsenal && (
            <StarterMix
              listOnPhone
              arsenal={data.arsenal}
              tto={data.arsenalTto}
              sides={data.arsenalSides}
              lefty={pitcher.hand === 'L'}
              name={pitcher.name}
            />
          )}
        </>
      ) : closed ? (
        <p className="roster__notice lsp__closed">The starting pitcher is not in the record for this game.</p>
      ) : projectedStarters?.length ? (
        <ProjectedStarters rows={projectedStarters} />
      ) : (
        <EmptyState size="compact">Not posted yet.</EmptyState>
      )}
    </Card>
  )
}
