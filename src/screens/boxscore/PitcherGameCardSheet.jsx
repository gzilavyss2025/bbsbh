import '../../styles/boxscore/pitcher-game-card.css'
import { useRef } from 'react'
import { buildPitcherGameCard } from '../../api/pitcher/gameCard.js'
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
// that names the club (ADR-0030). Plots: slice 4. PNG save: slice 5.

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

export function PitcherGameCardSheet({ feed, pitcher, teamId, teamAbbr, theme, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const card = buildPitcherGameCard(feed, pitcher.id)
  const name = card?.line.name || pitcher.name
  const [first, ...rest] = name.split(' ')
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
            <article className="pgc__card" style={headerThemeStyle(theme)}>
              <header className="pgc__band">
                <div className="pgc__who">
                  <p className="pgc__ctx">{[card.game.round, card.game.date].filter(Boolean).join(' · ')}</p>
                  <h2 className="pgc__name">
                    {rest.length ? <>{first}<br />{rest.join(' ')}</> : name}
                  </h2>
                  <p className="pgc__role">
                    {[teamAbbr, pitcher.hand && `${pitcher.hand}HP`, card.line.role].filter(Boolean).join(' · ')}
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
                      <span>{mph(m.velo)}</span>
                      <span>{m.whiffs}</span>
                      <span className="pgc__track" aria-hidden="true">
                        <i style={{ width: `${(m.usage ?? 0) * 100}%`, '--pitch': pitchMark(m.type).color }} />
                      </span>
                    </div>
                  ))}
                </section>
              )}

              <footer className="pgc__foot">
                <span className="pgc__brand">Tally Baseball</span>
                <span>{finalLine(card.game)}</span>
              </footer>
            </article>

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
