import { useRef } from 'react'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useNav } from '../../lib/nav.js'
import { gamePath, umpirePath } from '../../lib/route.js'
import { UmpireTendencies } from './UmpireTendencies.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { EmptyState } from '../ui/state/EmptyState.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { monthDayName } from '../../lib/dates.js'

const HP_GAMES_LIMIT = 5

const pct1 = (x) => (x == null ? '' : `${(x * 100).toFixed(1)}%`)

// The detail modal opened by ANY crew member's name on the lineup Umpires
// card — not just tonight's plate umpire. A base umpire has plate work of his
// own on other nights, and that's the question this answers, so the card it
// wraps is worth reaching from every name on the crew.
//
// Lazy-loads the umpire's whole record — season aggregate, rank, zone cells,
// and game log — and shows the Tendencies card plus his last five games behind
// the plate, each linking to that game's (sealed) box score. Same dialog
// contract as StrikeZoneModal / BallparkModal: dismiss via backdrop tap, the
// close button, or Escape; focus moves to the close button on open and back to
// the trigger on close. Everything shown is a ball/strike judgment count or a
// date/matchup already public on the umpire page — no score — so it sits
// outside any seal.
//
// `seasonYear` is the season of the game it opens from (#1201).
export function UmpireAccuracyModal({ id, seasonYear, onClose }) {
  const navigate = useNav()
  const { data } = useAsync(() => loadUmpire(id, { seasonYear }), [id, seasonYear])

  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)

  const season = data?.accuracy?.season ?? null
  // A plate game's row lives in whichever level's byGamePk map covers it —
  // data.accuracy (MLB) or data.accuracyAAA (AAA), see loadUmpire in
  // api/umpires.js. Checking both (rather than trusting this game row's own
  // `level` tag to match) means a call-up ump's AAA plate games still show
  // their per-game accuracy here instead of a blanket "—".
  const hpGames = (data?.games ?? [])
    .filter((g) => g.role === 'HP')
    .map((g) => ({
      ...g,
      row: data.accuracy?.byGamePk?.[g.gamePk] ?? data.accuracyAAA?.byGamePk?.[g.gamePk] ?? null,
    }))
    .slice(0, HP_GAMES_LIMIT)

  // Tag AAA rows with a small level pill, but only when this list actually
  // mixes levels — a call-up ump's log otherwise stays unlabeled since every
  // row is implicitly MLB (or, less often, entirely AAA).
  const hasMixedLevels =
    hpGames.some((g) => (g.level ?? 'MLB') === 'AAA') && hpGames.some((g) => (g.level ?? 'MLB') !== 'AAA')

  const openGame = (g) => {
    onClose()
    navigate(gamePath(g.date, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber))
  }

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div
        className="umpmodal"
        role="dialog"
        aria-modal="true"
        aria-label={data?.name ? `Plate accuracy for ${data.name}` : 'Plate accuracy'}
      >
        {/* This header carried the name, the rank and the accuracy percentage
            until the Tendencies card below started carrying all three; keeping
            it printed each of them twice on one sheet. What's left is the close
            affordance, plus a name for the two states the card can't render:
            still loading, and an umpire with no plate data at all. The dialog's
            aria-label names him in every case. */}
        <div className="umpmodal__head">
          <div className="umpmodal__ttl">
            {!season && (
              <>
                <span className="umpmodal__note">Plate accuracy</span>
                <span className="umpmodal__name">{data?.name ?? '…'}</span>
              </>
            )}
          </div>
          <button ref={closeRef} className="szmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {data && !season && (
          <EmptyState className="umpmodal__empty">No plate-accuracy data on file for this umpire yet.</EmptyState>
        )}

        {/* The Tendencies card carries the zone map now, beside the phrase that
            describes it. This modal used to draw its own copy here; two on one
            surface is one too many. */}
        {data && <UmpireTendencies umpire={data} />}

        {hpGames.length > 0 && (
          <section className="umpmodal__games">
            <h3 className="umpmodal__gtitle">Last {hpGames.length} behind the plate</h3>
            <ul className="umpmodal__glist">
              {hpGames.map((g) => (
                <li key={`${g.gamePk}-${g.gameNumber}`} className="umpmodal__grow">
                  <span className="umpmodal__gdate">{monthDayName(g.date)}</span>
                  <span className="umpmodal__gmatchrow">
                    <button type="button" className="plink umpmodal__gmatch" onClick={() => openGame(g)}>
                      {g.awayAbbr} @ {g.homeAbbr}
                    </button>
                    {hasMixedLevels && (g.level ?? 'MLB') === 'AAA' && (
                      <Pill>AAA</Pill>
                    )}
                  </span>
                  <span className="umpmodal__gacc">
                    {g.row?.called ? pct1(g.row.correct / g.row.called) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && (
          <button type="button" className="btn btn--ink btn--next umpmodal__full" onClick={() => { onClose(); navigate(umpirePath(id, data?.name)) }}>
            Full umpire page
          </button>
        )}
      </div>
    </div>
  )
}
