import { useId, useState } from 'react'
import { PENNANT_ART, pennantModel } from './pennantModel.js'
import '@fontsource/bungee/latin-400.css'
import '@fontsource/yellowtail/latin-400.css'
import '../../styles/honors/league-pennant.css'

// A champion's pennant: the club mark moves left and the trophy (215x435) stands at its right.
const WS_ART = {
  full: { mark: { x: 52, y: 83, width: 140, height: 143 }, trophy: { x: 196, y: 78, width: 76, height: 154 } },
  compact: { mark: { x: 40, y: 87, width: 160, height: 170 }, trophy: { x: 200, y: 80, width: 90, height: 182 } },
}

function PennantMark({ url, abbreviation, box, id }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <text
        x="160" y={box.y + box.height * 0.68} textAnchor="middle"
        fontFamily="var(--font-display)" fontSize={Math.min(62, 200 / Math.max(1, abbreviation.length) * 1.3)}
        fill="var(--pennant-ink)"
      >{abbreviation}</text>
    )
  }
  return (
    <>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" {...box} style={{ maskType: 'alpha' }}>
          {/* eslint-disable-next-line react/no-unknown-property -- SVG images emit error events when their asset fails. */}
          <image href={url} {...box} preserveAspectRatio="xMidYMid meet" onError={() => setFailed(true)} />
        </mask>
      </defs>
      <rect {...box} fill="var(--pennant-ink)" mask={`url(#${id})`} />
    </>
  )
}

/**
 * Flat league-champion artwork, shared by team and player pages.
 * `league` is the SEASON'S AL/NL, never inferred from today's club.
 * See docs/pennants.md for identity overrides and the editing contract.
 */
export function LeaguePennant({
  teamId, season, league, teamName, clubLabel, abbreviation,
  variant = 'full', width = 160, palette, logoUrl,
  lettering = 'block', decorative = false, className = '', ws = false,
}) {
  const id = useId()
  const model = pennantModel({ teamId, season, league, teamName, clubLabel, abbreviation, logoUrl, palette })
  if (!model) return null
  const compact = variant === 'compact'
  const script = lettering === 'script'
  const size = Number.isFinite(width) && width > 0 ? width : 160
  const { field, border, ink, year } = model.palette
  const heading = script ? model.clubLabel : model.clubLabel.toUpperCase() // caps-js-exempt: printed artwork capitals
  const leagueLabel = model.leagueName.toUpperCase() // caps-js-exempt: printed artwork capitals
  const headingSize = Math.min(script ? 43 : 23, 265 / Math.max(1, heading.length) / (script ? 0.5 : 0.55))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PENNANT_ART.width} ${PENNANT_ART.height}`}
      width={size} height={size * PENNANT_ART.height / PENNANT_ART.width}
      className={`leaguehonor ${className}`.trim()}
      style={{ '--pennant-field': field, '--pennant-border': border, '--pennant-ink': ink, '--pennant-year': year }}
      role={decorative ? undefined : 'img'}
      aria-labelledby={decorative ? undefined : `${id}-title`}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {!decorative && <title id={`${id}-title`}>{ws ? `${model.season} ${teamName || model.clubLabel}, World Series champions` : model.label}</title>}
      <g aria-hidden="true">
        <path d={PENNANT_ART.outline} fill="var(--pennant-field)" stroke="var(--pennant-border)" strokeWidth="6" />
        {/* The block-lettered club name is off (Gary, 2026-10-30); only script lettering prints one. */}
        {!compact && script && (
          <text
            className={script ? 'leaguehonor__script' : undefined}
            x="160" y="49" textAnchor="middle" fill="var(--pennant-ink)"
            fontFamily={script ? 'Yellowtail, cursive' : 'var(--font-display)'}
            fontWeight={script ? 400 : 700} fontSize={headingSize} letterSpacing={script ? 0 : 2}
          >{heading}</text>
        )}
        <PennantMark
          key={model.logoUrl ?? model.abbreviation}
          url={model.logoUrl} abbreviation={model.abbreviation}
          box={ws ? WS_ART[compact ? 'compact' : 'full'].mark : compact ? PENNANT_ART.compactMark : PENNANT_ART.mark} id={`${id}-mark`}
        />
        {/* A World Series winner's pennant carries the trophy beside the mark (Gary, 2026-10-30). */}
        {ws && <image href="/brand/world-series-trophy.png" {...WS_ART[compact ? 'compact' : 'full'].trophy} preserveAspectRatio="xMidYMid meet" />}
        <text
          x="160" y={compact ? 380 : 331} textAnchor="middle" fill="var(--pennant-year)"
          fontFamily="Bungee, sans-serif" fontSize={compact ? 99 : 97}
        >{model.season}</text>
        {!compact && (
          <g fill="var(--pennant-ink)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="31" letterSpacing="2">
            <text x="160" y="383">{ws ? 'WORLD SERIES' : `${leagueLabel} LEAGUE`}</text>
            <text x="160" y="428">CHAMPIONS</text>
          </g>
        )}
      </g>
    </svg>
  )
}
