import { useState } from 'react'
import { GameStamp } from '../../components/logbook/GameStamp.jsx'

// Every stamp you hold, season by season — the grid that has always sat below
// the book, now behind a disclosure and CLOSED when the page loads.
//
// Why closed. This grid is the collection said twice: the book above it already
// draws each keepsake on the page its owner put it on, and this is the same
// keepsakes again as a list. It is the useful half when you want to FIND one
// (it is season-paged, and it says which page each stamp is on), and it is a
// second wall of stamp art when you don't. So it waits to be asked for. The
// disclosure follows the mint strip's own Details control
// (components/logbook/StampGameButton.jsx) rather than inventing a second shape.
//
// Split out of LogbookCollection.jsx, which was at check-file-size.mjs's
// 600-line ceiling; the markup below moved across unchanged apart from the card
// around it. Everything it needs is passed in — it resolves nothing and holds
// no state but its own open/closed.

export function StampCollection({
  seasons = [],
  season = null,
  counts = {},
  stamps = [],
  factsByPk = {},
  loading = false,
  isFiled,
  monthDay,
  onSeason,
  onStats,
  onOpenGame,
  onOpenOptions,
}) {
  const [open, setOpen] = useState(false)
  const bodyId = 'stampcollection-body'

  return (
    <section className="stampcard">
      <button
        type="button"
        className="stampcard__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="stampcard__title">All your stamps</span>
        <span className="stampcard__meta">
          {stamps.length} {stamps.length === 1 ? 'stamp' : 'stamps'}
          {season ? ` · ${season}` : ''}
        </span>
        <span className="stampcard__chev" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="stampcard__body" id={bodyId}>
          {seasons.length > 1 && (
            <nav className="logbook__seasons" aria-label="Game Log seasons">
              {seasons.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={year === season ? 'is-active' : ''}
                  aria-current={year === season ? 'page' : undefined}
                  onClick={() => onSeason?.(year)}
                >
                  {year}
                  <small>{counts[year]}</small>
                </button>
              ))}
            </nav>
          )}

          <p className="stampcard__through">
            <button type="button" className="btn btn--chip" onClick={() => onStats?.()}>
              What it adds up to ›
            </button>
          </p>

          <ul className="logbook__grid">
            {stamps.map((entry) => {
              const game = factsByPk[entry.gamePk]
              return (
                <li className="logbook__cell" key={entry.gamePk}>
                  {game ? (
                    <button
                      type="button"
                      className="logbook__stampbtn"
                      onClick={() => onOpenGame?.(entry.gamePk)}
                    >
                      <GameStamp game={game} />
                    </button>
                  ) : (
                    // Facts unresolved (offline, or a batch that failed). The
                    // keepsake still belongs to the user, so it holds its place
                    // with what the local record itself carries rather than
                    // vanishing from the grid.
                    <div className="logbook__pending">
                      <span>{monthDay(entry.date)}</span>
                      <small>{loading ? 'Loading' : 'Not available offline'}</small>
                    </div>
                  )}
                  <p className="logbook__caption">
                    <span>{monthDay(entry.date)}</span>
                    <span className="logbook__mode">{entry.mode}</span>
                    {isFiled(entry) ? (
                      // Which page this keepsake sits on, and the way back to
                      // it. Deliberately no longer an un-place: a control
                      // labelled "p.3" that silently took the stamp off page 3
                      // was the only thing here that could undo a placement,
                      // and it read as a page number. It now turns the book to
                      // that page and opens the stamp's options, where moving
                      // it and returning it to the tray are both named.
                      // `isFiled`, not `entry.placement`: a placement naming a
                      // book that is gone has no page to send anyone to.
                      <button
                        type="button"
                        className="logbook__unplace"
                        aria-label={`Options for the ${monthDay(entry.date)} stamp on page ${entry.placement.page}`}
                        onClick={() => onOpenOptions?.(entry)}
                      >
                        p.{entry.placement.page}
                      </button>
                    ) : (
                      <span className="logbook__unplaced">unplaced</span>
                    )}
                  </p>
                  {entry.note && <p className="logbook__note">{entry.note}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
