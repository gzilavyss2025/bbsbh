import { useEffect, useRef } from 'react'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { SealBox } from '../../../../components/SealBox.jsx'
import { ModalPortal } from '../../../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'
import { useDialogFocus } from '../../../../hooks/dialog/useDialogFocus.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { WinProbChart } from '../../../../components/charts/WinProbChart.jsx'
import { fetchWinProbability } from '../../../../api/game.js'
import { selectWinProbPath, selectWinProbBigPlays, winProbSplit } from '../../../../api/winprob.js'
import { batterDayLine } from '../../../../api/gameday/dayLine.js'
import { safeStep, stepCutAtBatIndex } from '../../../../api/gameday/stepCut.js'
import { halfIndex } from '../../../../api/select.js'
import { lineupEntering } from '../../../../api/battingorder.js'
import { GamedayPanel } from './GamedayPanels.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'

// The bar's Box and Win % sheets (Gary, 2026-10-29), each over the page and back to the same spot on close.
// Both read the game AS OF THE READER'S STEP, never the whole feed: everything that names a result reads
// inside a SealBox reveal function and only once the half on screen is within reach (revealedThrough + 1),
// the reach the arm panel and the pitching lines keep. A half past it draws "Sealed".

function Sheet({ title, onClose, children }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  return (
    <ModalPortal>
      <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="gdsheet" role="dialog" aria-modal="true" aria-label={title}>
          <div className="gdsheet__head">
            <h2>{title}</h2>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>
          <div className="gdsheet__body">{children}</div>
        </div>
      </div>
    </ModalPortal>
  )
}

// The reader's reach and the at-bat cut that bounds every value here.
function reachOf(ctx) {
  const here = halfIndex(ctx.inning, ctx.half)
  if (here > (ctx.mark ?? -1) + 1) return null
  return { here, cut: stepCutAtBatIndex(ctx.feed, ctx.inning, ctx.half, safeStep(ctx.step, here, ctx.mark)) }
}

const Sealed = () => <p className="gdsheet__empty">Sealed</p>

// Each club's hitters with their line tonight as of the step (dayLine.js), in batting order.
function BattingLines({ ctx }) {
  const at = { inning: ctx.inning, half: ctx.half, step: ctx.step, revealedThrough: ctx.mark }
  return ['away', 'home'].map((side) => {
    const order = lineupEntering(ctx.feed, side, ctx.inning, ctx.half, ctx.mark) ?? []
    const club = ctx.meta?.[side]
    return (
      <table key={side} className="gdsheet__table">
        <thead>
          <tr><th>{club?.abbreviation ?? side}</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th></tr>
        </thead>
        <tbody>
          {order.map(({ slot, entries }) => entries.map((p) => {
            const l = batterDayLine(ctx.feed, p.id, at)
            return (
              <tr key={`${slot}-${p.id}`}>
                <td>{p.last}</td><td>{l?.ab ?? 0}</td><td>{l?.h ?? 0}</td><td>{l?.r ?? 0}</td><td>{l?.rbi ?? 0}</td><td>{l?.bb ?? 0}</td><td>{l?.k ?? 0}</td>
              </tr>
            )
          }))}
        </tbody>
      </table>
    )
  })
}

export function BoxSheet({ ctx, onClose, onFull }) {
  const reach = reachOf(ctx)
  return (
    <Sheet title="Box score so far" onClose={onClose}>
      {/* The line score as the strip draws it, R / H / E as of the step. */}
      <GamedayPanel block="navigator" ctx={{ ...ctx, onSelect: () => {}, disabled: true }} />
      {reach ? (
        <SealBox key={`${ctx.inning}-${ctx.half}`} forceRevealed coverless>
          {() => (
            <>
              <h3 className="gdsheet__sub">Batting</h3>
              <div className="gdsheet__pair"><BattingLines ctx={ctx} /></div>
              <h3 className="gdsheet__sub">Pitching</h3>
              <GamedayPanel block="pitchingLines" ctx={ctx} />
            </>
          )}
        </SealBox>
      ) : <Sealed />}
      {onFull && <button type="button" className="gdsheet__door" onClick={onFull}>Full box score ›</button>}
    </Sheet>
  )
}

// How a club scored, as of the step (Gary, 2026-10-29: a tap on its half of the score bug). Its scoring plays in
// order: whole halves before the one on screen, that half up to the last at-bat shown (the band's own
// clamp, the half on screen caps it), so the list never runs past the score the band shows.
function scoringPlays(ctx, side) {
  const here = halfIndex(ctx.inning, ctx.half)
  const cut = stepCutAtBatIndex(ctx.feed, ctx.inning, ctx.half, safeStep(ctx.step, here, ctx.mark))
  return (ctx.feed?.liveData?.plays?.allPlays ?? []).filter((p) => {
    const a = p.about ?? {}
    if (!a.isScoringPlay || (side && (a.halfInning === 'top' ? 'away' : 'home') !== side)) return false
    const i = halfIndex(a.inning, a.halfInning)
    return i < here || (i === here && (a.atBatIndex ?? Infinity) <= cut)
  })
}

// It drops from under the score bug, the bug's full width and joined to it (Gary, 2026-10-29), rather than
// floating mid-page: the place its runs were tapped. Escape, the ✕ or a tap outside it closes it.
// Closing plays the opening in reverse (Gary, 2026-10-29): `closing` slides it back up under the bug, and
// `onClosed` fires when that ends (at once under reduced motion, where nothing animates).
function Drop({ title, onClose, closing = false, onClosed, head = null, children }) {
  const ref = useRef(null)
  useEffect(() => {
    if (closing && (motionIsReduced() || !ref.current?.getAnimations?.().length)) onClosed?.()
  }, [closing, onClosed])
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const key = (e) => e.key === 'Escape' && onClose()
    const out = (e) => !ref.current?.contains(e.target) && !e.target.closest?.('.inhead__teambtn') && onClose()
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', out)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', out) }
  }, [onClose])
  return (
    <div ref={ref} className={`gddrop${closing ? ' is-closing' : ''}`} role="dialog" aria-label={title} onAnimationEnd={() => closing && onClosed?.()}>
      {head ? (
        <div className="gddrop__head">{head}<IconButton ref={closeRef} mark="md" className="gddrop__close" onClick={onClose} label="Close">✕</IconButton></div>
      ) : (
        <div className="gdsheet__head">
          <h2>{title}</h2>
          <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
        </div>
      )}
      <div className="gdsheet__body">{children}</div>
    </div>
  )
}

// Both clubs' runs in game order (Gary, 2026-10-29: either half of the bug opens the one summary).
export function ScoringSheet({ ctx, onClose, closing = false, onClosed }) {
  const away = ctx.meta?.away ?? {}
  const home = ctx.meta?.home ?? {}
  const reach = reachOf(ctx)
  return (
    // The house bar with both clubs' marks: the summary is the game's, not one club's.
    <Drop title="Scoring summary" onClose={onClose} closing={closing} onClosed={onClosed}
      head={<div className="gdp__band">
        <SectionHead look="band" as="h2" mark={<span className="gddrop__marks">
          <TeamLogo teamId={away.id} name={away.clubName ?? ''} size={22} variant="mono" crop="bar" className="sectionhead__mark" />
          <TeamLogo teamId={home.id} name={home.clubName ?? ''} size={22} variant="mono" crop="bar" className="sectionhead__mark" />
        </span>}>
          Scoring summary
        </SectionHead>
      </div>}>
      {!reach ? <Sealed /> : (
        <SealBox key={`${ctx.inning}-${ctx.half}`} forceRevealed coverless>
          {() => {
            const plays = scoringPlays(ctx, null)
            if (!plays.length) return <p className="gdsheet__empty">No runs yet.</p>
            return (
              <ol className="gdruns">
                {plays.map((p) => (
                  <li key={p.about.atBatIndex}>
                    {/* ▲ top / ▼ bottom and the inning, as the score bug marks the half (Gary, 2026-10-29). */}
                    <span className="gdruns__inn" aria-label={`${p.about.halfInning === 'top' ? 'Top' : 'Bottom'} ${p.about.inning}`}>{p.about.halfInning === 'top' ? '▲' : '▼'} {p.about.inning}</span>
                    <p>{p.result?.description}</p>
                    {/* The clubs by their marks, not abbreviations. */}
                    <b className="gdruns__score" aria-label={`${ctx.meta?.away?.abbreviation} ${p.result?.awayScore}, ${ctx.meta?.home?.abbreviation} ${p.result?.homeScore}`}>
                      <TeamLogo teamId={ctx.meta?.away?.id} name={ctx.meta?.away?.abbreviation ?? ''} size={18} /> {p.result?.awayScore}
                      <span aria-hidden="true">·</span>
                      <TeamLogo teamId={ctx.meta?.home?.id} name={ctx.meta?.home?.abbreviation ?? ''} size={18} /> {p.result?.homeScore}
                    </b>
                  </li>
                ))}
              </ol>
            )
          }}
        </SealBox>
      )}
    </Drop>
  )
}

// The chart only ever plots the plays on screen: selectWinProbPath's own step clamp (throughHalf = the mark,
// the stepped half up to the last at-bat shown), which refuses any half past the next one.
export function WinProbSheet({ ctx, onClose }) {
  const pk = ctx.feed?.gamePk
  const { data: wp, loading } = useAsync(() => (pk ? fetchWinProbability(pk) : Promise.resolve(null)), [pk])
  const reach = reachOf(ctx)
  const away = ctx.meta?.away ?? {}
  const home = ctx.meta?.home ?? {}
  return (
    <Sheet title="Win probability so far" onClose={onClose}>
      {!reach ? <Sealed /> : loading && !wp ? <p className="gdsheet__empty">…</p> : (
        <SealBox key={`${ctx.inning}-${ctx.half}`} forceRevealed coverless>
          {() => {
            const at = { throughHalf: ctx.mark ?? -1, stepHalfIndex: reach.here, throughAtBatIndex: reach.cut }
            const points = selectWinProbPath(wp, at)
            if (!points.length) return <p className="gdsheet__empty">No win probability yet for this game.</p>
            const split = winProbSplit(points)
            return (
              <>
                <p className="gdsheet__split"><b>{away.abbreviation} {split.away}%</b><span>·</span><b>{home.abbreviation} {split.home}%</b></p>
                <WinProbChart points={points} bigPlays={selectWinProbBigPlays(wp, at)} awayAbbr={away.abbreviation} homeAbbr={home.abbreviation}
                  awayId={away.id} homeId={home.id} awayTreatment={ctx.treatment?.away} homeTreatment={ctx.treatment?.home} partial />
              </>
            )
          }}
        </SealBox>
      )}
    </Sheet>
  )
}

