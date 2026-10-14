import { useEffect, useMemo } from 'react'
import { fetchPlayerContractHistory } from '../../../../../api/contractsHistory.js'
import { fetchPlayerContract } from '../../../../../api/person/contracts.js'
import { StatTile } from '../../../../../components/ui/frame/StatTile.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import '../../../../../styles/player-next/both/contract.css'
import { contractBoard } from './contractView.js'

// The Contract card (#1929): the board's pay, pay rank, colour strip (club sets pay,
// arbitration, signed, option, free agency) and a "Salary history" part with a bar per
// season, a career total and 2020 flagged. An open surface (ADR-0052). The page skips
// the contract fetch on a past date (api/player/overview.js), so this does too. A
// two-way player gets one card, on the hitting instance.
export default function ContractModule({ bio, role, asOf, onEmpty, onCount }) {
  const skip = asOf || (role === 'pitching' && bio.twoWay)
  const { data, loading } = useAsync(
    () => (skip ? null : Promise.all([fetchPlayerContract(bio.id), fetchPlayerContractHistory(bio.id)])),
    [bio.id, skip],
  )
  const board = useMemo(() => data && contractBoard(data[0], data[1]), [data])
  useEffect(() => {
    if (!loading && !board) onEmpty()
    else if (board) onCount(board.pill)
  }, [loading, board, onEmpty, onCount])

  // Holds the card's height while the shards load.
  if (loading) return <div className="contractcard cnext cnext--wait" aria-busy="true" />
  if (!board) return null
  return (
    <section className="contractcard cnext" aria-label="Contract">
      {board.salary || board.strip ? <Pay board={board} /> : null}
      {board.rank && <Rank rank={board.rank} />}
      {board.tiles.length > 0 && (
        <div className="cnext__tiles">
          {board.tiles.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
        </div>
      )}
      {board.strip && <Ahead strip={board.strip} />}
      {board.past && <History past={board.past} />}
    </section>
  )
}

function Pay({ board }) {
  return (
    <div className="cnext__pay">
      <span className="cnext__label">{board.season} salary</span>
      {board.salary ? (
        <span className="cnext__salary">{board.salary}</span>
      ) : (
        <>
          <span className="cnext__soft">{board.noFigure[0]}</span>
          {board.noFigure[1] && <span className="cnext__note">{board.noFigure[1]}</span>}
        </>
      )}
    </div>
  )
}

function Rank({ rank }) {
  return (
    <div className="cnext__rank">
      <div className="cnext__ranktop">
        <span className="cnext__tag" style={{ left: `${rank.tagLeft}%` }}>{rank.text}</span>
      </div>
      <div className="cnext__track" role="img" aria-label={rank.aria}>
        <div className="cnext__fill" style={{ width: `${rank.frac * 100}%` }} />
      </div>
      <div className="cnext__ends"><span>Lowest paid</span><span>Highest paid</span></div>
    </div>
  )
}

function Ahead({ strip }) {
  return (
    <div className="cnext__ahead">
      <span className="cnext__label">Ahead</span>
      <div className="cnext__strip" role="img" aria-label={strip.aria}>
        {strip.cols.map((c) => (
          <div key={c.year} className="cnext__col" aria-hidden="true">
            <div className={`cnext__yr${c.now ? ' cnext__yr--now' : ''}`}>{c.year}</div>
            <div className={`cnext__st cnext__st--${c.kind}`}>
              {c.status && <span className="cnext__stlabel">{c.status}</span>}
              {c.money && <span className="cnext__stmoney">{c.money}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="cnext__legend">
        {strip.legend.map((k) => (
          <span key={k.kind}><i className={`cnext__swatch cnext__st--${k.kind}`} aria-hidden="true" />{k.label}</span>
        ))}
      </div>
    </div>
  )
}

function History({ past }) {
  return (
    <details className="cnext__hist">
      <summary>
        <span className="cnext__histname">Salary history</span>
        <span className="cnext__histend">
          <span className="cnext__histsub">{past.total} · {past.seasons} {past.seasons === 1 ? 'season' : 'seasons'}</span>
          <svg className="cnext__chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          </svg>
        </span>
      </summary>
      <p className="cnext__note">
        {past.label}: {past.total}
        {past.left ? '; 2020 left out' : ''}
        {past.unconfirmed ? '; some rows are matches the source could not confirm' : ''}
      </p>
      <div className="cnext__bars" role="img" aria-label={past.aria}>
        {past.bars.map((b) => (
          <div key={b.year} className={`cnext__bar cnext__bar--${b.kind}`} style={b.pct ? { height: `${b.pct}%` } : undefined} />
        ))}
      </div>
      <div className="cnext__barlabels" aria-hidden="true">
        {past.bars.map((b) => (
          <span key={b.year}>
            {b.money && <strong>{b.money}</strong>}
            {b.tick}
          </span>
        ))}
      </div>
      {(past.left || past.gap) && (
        <div className="cnext__legend">
          {past.gap && <span><i className="cnext__swatch cnext__bar--gap" aria-hidden="true" />No figure</span>}
          {past.left && <span><i className="cnext__swatch cnext__bar--left" aria-hidden="true" />2020, left out</span>}
        </div>
      )}
    </details>
  )
}
