import { useId, useState } from 'react'
import { PENNANT_ART, pennantModel } from './pennantModel.js'
import '@fontsource/bungee/latin-400.css'
import '@fontsource/yellowtail/latin-400.css'
import '../../styles/honors/league-pennant.css'

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
  lettering = 'block', decorative = false, className = '',
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
      {!decorative && <title id={`${id}-title`}>{model.label}</title>}
      <g aria-hidden="true">
        <path d={PENNANT_ART.outline} fill="var(--pennant-field)" stroke="var(--pennant-border)" strokeWidth="6" />
        {!compact && (
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
          box={compact ? PENNANT_ART.compactMark : PENNANT_ART.mark} id={`${id}-mark`}
        />
        <text
          x="160" y={compact ? 380 : 331} textAnchor="middle" fill="var(--pennant-year)"
          fontFamily="Bungee, sans-serif" fontSize={compact ? 99 : 97}
        >{model.season}</text>
        {!compact && (
          <g fill="var(--pennant-ink)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="31" letterSpacing="2">
            <text x="160" y="373">{leagueLabel}</text>
            <text x="160" y="408">LEAGUE</text>
            <text x="160" y="443">CHAMPIONS</text>
          </g>
        )}
      </g>
    </svg>
  )
}
