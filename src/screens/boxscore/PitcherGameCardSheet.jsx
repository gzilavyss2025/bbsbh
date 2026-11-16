import '../../styles/boxscore/pitcher-game-card.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPitcherGameCard } from '../../api/pitcher/gameCard.js'
import { fetchPitchArsenalFor, PHYS_FIELDS } from '../../api/pitcher/arsenal.js'
import { selectGameSeason } from '../../api/select.js'
import { seasonByCode, veloDelta } from '../../lib/pitch/cardPlots.js'
import { paintGameCard, cardFilename } from '../../lib/gamecard/paintGameCard.js'
import { loadPosterImages } from '../../lib/preview/posterImages.js'
import { realHeadshotUrl } from '../../lib/teams/headshots.js'
import { useAsync } from '../../hooks/useAsync.js'
import { SavePosterButton } from '../../components/preview/SavePosterButton.jsx'
import { GameCardPlots } from './GameCardPlots.jsx'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { headerThemeStyle } from '../../lib/colors/headerTheme.js'
import { PitchMark } from '../../components/playbyplay/pitcherCard/PitchMark.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// The pitcher game card (#2969, slice 3): one pitcher's night as a card made
// to be shared, opened from a stat cell of his row in the box score's pitching
// table. That table renders only inside the box score's SealBox reveal
// function, and this sheet mounts only on a tap there, so nothing here exists
// before the reveal (ADR-0001, ADR-0002). buildPitcherGameCard is reveal-only.
//
// The card (<article>) says who, which game and how he did, so it reads on its
// own as a picture; the arsenal detail sits under it and stays out of the
// image. Its band wears the club's jersey colours: a club may colour a card
// that names the club (ADR-0030). The plots compare against his season
// arsenal (spoiler-free, api/pitcher/arsenal.js) for the GAME's season only.
// "Save card as image" paints the same card on a canvas (lib/gamecard/).

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const mph = (x) => (x == null ? '—' : x.toFixed(1))

const TIPS = {
  Whiffs: 'Swings and misses.',
  'Hard-hit': 'Balls in play hit 95 mph or harder.',
  Barrels: 'Balls hit at the speed and angle that most often go for extra bases (Statcast).',
}

function headline(l) {
  const runs = l.er === l.r ? `${l.r} R` : `${l.r} R (${l.er} ER)`
  return [`${l.h} H`, runs, `${l.bb} BB`, `${l.k} K`, l.hr > 0 && `${l.hr} HR`].filter(Boolean).join(' · ')
}

function finalLine(g) {
  if (g.away.runs == null || g.home.runs == null) return ''
  const tail = g.final ? ` · F${g.innings ? `/${g.innings}` : ''}` : ''
  return `${g.away.abbr} ${g.away.runs} · ${g.home.abbr} ${g.home.runs}${tail}`
}

// The colours and fonts the image paints with, read off the card as rendered,
// so the PNG wears the same club band and tokens (night mode included).
function paletteOf(el) {
  const cs = getComputedStyle(el)
  const band = getComputedStyle(el.querySelector('.pgc__band'))
  const v = (k) => cs.getPropertyValue(k).trim()
  return [
    {
      card: v('--surface-card'), page: v('--bg-canvas') || v('--surface-card'), ink: v('--surface-stamped-ink'),
      onInk: v('--text-on-ink'), text: v('--text-heading'), muted: v('--text-muted'), rule: v('--border-hairline'),
      marker: v('--marker'), band: band.backgroundColor, bandText: band.color, bandAccent: band.borderBottomColor,
    },
    { display: v('--font-display'), mono: v('--font-mono') },
  ]
}

export function PitcherGameCardSheet({ feed, pitcher, teamId, teamAbbr, theme, onClose }) {
  const closeRef = useRef(null)
  const cardRef = useRef(null)
  const canvasRef = useRef(null)
  const [painted, setPainted] = useState(false)
  useDialogFocus(closeRef, onClose)
  const card = useMemo(() => buildPitcherGameCard(feed, pitcher.id), [feed, pitcher.id])
  const seasonYear = selectGameSeason(feed)
  const arsenal = useAsync(() => fetchPitchArsenalFor(pitcher.id, { seasonYear, strict: true }), [pitcher.id, seasonYear])
  const season = useMemo(() => {
    const byCode = seasonByCode(arsenal.data?.pit?.[String(pitcher.id)], PHYS_FIELDS)
    const deltas = new Map(card?.mix.map((m) => [m.type, veloDelta(m.velo, byCode.get(m.type)?.velo)]) ?? [])
    return { byCode, deltas }
  }, [arsenal.data, pitcher.id, card])
  const name = card?.line.name || pitcher.name
  const [first, ...rest] = name.split(' ')
  const role = [teamAbbr, pitcher.hand && `${pitcher.hand}HP`, card?.line.role].filter(Boolean).join(' · ')

  // Paint the image once the card and its season figures have settled, so the
  // Save tap shares straight away (SavePosterButton: the activation window).
  useEffect(() => {
    if (!card || arsenal.loading || !cardRef.current || !canvasRef.current) return
    let live = true
    const [colours, fonts] = paletteOf(cardRef.current)
    Promise.all([loadPosterImages({ headshot: realHeadshotUrl(pitcher.id, 360) }), document.fonts?.ready]).then(([art]) => {
      if (!live) return
      paintGameCard(canvasRef.current, {
        card, name, season,
        role: `${role}${pitcher.dec ? ` · ${pitcher.dec}` : ''}`,
        ctxLine: [card.game.round, card.game.date].filter(Boolean).join(' · '),
        headline: headline(card.line),
        sub: `${card.line.pitches} pitches, ${card.line.strikes} strikes`,
        figures: [['Whiffs', card.line.swStr], ['Hard-hit', card.line.hardHit], ['Barrels', card.line.barrels]],
        final: finalLine(card.game),
      }, art, colours, fonts)
      setPainted(true)
    })
    return () => {
      live = false
    }
  }, [card, season, arsenal.loading, name, role, pitcher.id, pitcher.dec])
  return (
    <div className="scrim pgc-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Stack gap="loose" className="sheet pgc" role="dialog" aria-modal="true" aria-label={`Game card, ${name}`}>
        <div className="pgc__bar">
          <span className="t-label t-label--bold">Game card</span>
          <IconButton ref={closeRef} label="Close" onClick={onClose}>✕</IconButton>
        </div>

        {!card ? (
          <p className="hint">Not posted yet.</p>
        ) : (
          <>
            <article ref={cardRef} className="pgc__card" style={headerThemeStyle(theme)}>
              <header className="pgc__band">
                <div className="pgc__who">
                  <p className="pgc__ctx">{[card.game.round, card.game.date].filter(Boolean).join(' · ')}</p>
                  <h2 className="pgc__name">
                    {rest.length ? <>{first}<br />{rest.join(' ')}</> : name}
                  </h2>
                  <p className="pgc__role">
                    {role}
                    {pitcher.dec && <span className={`bs__dec bs__dec--${pitcher.dec === 'L' ? 'loss' : 'win'}`}>{pitcher.dec}</span>}
                  </p>
                </div>
                <Headshot personId={pitcher.id} name={name} teamId={teamId} tint={false} className="pgc__shot" />
              </header>

              <div className="pgc__hero">
                <span className="pgc__ip"><b>{card.line.ip}</b> IP</span>
                <p className="pgc__line">
                  {headline(card.line)}
                  <span>{card.line.pitches} pitches, {card.line.strikes} strikes</span>
                </p>
              </div>

              <div className="pgc__trio">
                {[['Whiffs', card.line.swStr], ['Hard-hit', card.line.hardHit], ['Barrels', card.line.barrels]].map(([label, v]) => (
                  <div key={label} className="pgc__fig infopop-row">
                    <b>{v}</b>
                    <span>
                      {label} <InfoPopover label={`What ${label} means`} className="infopop--paper">{TIPS[label]}</InfoPopover>
                    </span>
                  </div>
                ))}
              </div>

              {card.mix.length > 0 && (
                <section className="pgc__mix" aria-label="What he threw">
                  <h3 className="pgc__label">What he threw</h3>
                  <div className="pgc__mixrow pgc__mixrow--head" aria-hidden="true">
                    <span /><span /><span>Use</span><span>Mph</span><span>Whiffs</span>
                  </div>
                  {card.mix.map((m) => (
                    <div key={m.type} className="pgc__mixrow">
                      <PitchMark mark={pitchMark(m.type)} size={12} />
                      <span className="pgc__pitch">{m.name}</span>
                      <span>{pct(m.usage)}</span>
                      <span>
                        {mph(m.velo)}
                        {season.deltas.get(m.type) && <small className="pgc__delta"> {season.deltas.get(m.type)}</small>}
                      </span>
                      <span>{m.whiffs}</span>
                      <span className="pgc__track" aria-hidden="true">
                        <i style={{ width: `${(m.usage ?? 0) * 100}%`, '--pitch': pitchMark(m.type).color }} />
                      </span>
                    </div>
                  ))}
                </section>
              )}

              <GameCardPlots pitches={card.pitches} mix={card.mix} season={season.byCode} />

              <footer className="pgc__foot">
                <span className="pgc__brand">Tally Baseball</span>
                <span>{finalLine(card.game)}</span>
              </footer>
            </article>

            <canvas ref={canvasRef} hidden />
            <SavePosterButton
              canvasRef={canvasRef}
              filename={cardFilename(name, feed?.gameData?.datetime?.officialDate)}
              title={`${name}, game card`}
              label="Save card as image"
              ariaLabel={`Save ${name}'s game card as an image`}
              disabled={!painted}
            />

            {card.mix.length > 0 && (
              <Card frame="stamped" label="Arsenal detail" labelAs="h3" body="flush" className="pgc__detail">
                <Table frame="bare" density="tight" sticky label="Arsenal detail" className="pgc__table">
                  <thead>
                    <tr><th>Pitch</th><th>vs R</th><th>vs L</th><th>Zone</th><th>Chase</th><th>Whiff/pitch</th></tr>
                  </thead>
                  <tbody>
                    {card.mix.map((m) => (
                      <tr key={m.type}>
                        <td>{m.name}</td>
                        <td>{pct(m.usageVsR)}</td><td>{pct(m.usageVsL)}</td><td>{pct(m.zonePct)}</td><td>{pct(m.chasePct)}</td><td>{pct(m.swStrPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}
          </>
        )}
      </Stack>
    </div>
  )
}
