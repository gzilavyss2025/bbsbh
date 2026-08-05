import { useEffect, useState } from 'react'

// Shared loading indicator: a hand-set manual scoreboard plate, styled as a
// mini National League linescore (two team rows, five columns) with one
// cell — Milwaukee's second inning — cycling 1 thru 9 as the "still
// working" tell. Replaces bare "Loading…" hints across the app so every
// wait reads in the same scorebook voice. Decorative art is aria-hidden;
// `message` is empty by default (the board reads as self-explanatory on its
// own) but callers can still pass a status line where the wait needs more
// context (GameFinder, WhatsBrewingModal), rendered next to the board and
// still announced via the container's aria-live region. Reduced-motion
// users see the plate resting on 1.
//
// `size`:
//   'page'   — full-screen cold-load screens (the default)
//   'inline' — section-level placeholders that sit inside a card/column
function useScoreboardNumber() {
  const [number, setNumber] = useState(1)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer

    function update() {
      window.clearInterval(timer)
      setNumber(1)
      if (!media.matches) {
        timer = window.setInterval(() => setNumber((current) => (current % 9) + 1), 750)
      }
    }

    update()
    media.addEventListener('change', update)
    return () => {
      window.clearInterval(timer)
      media.removeEventListener('change', update)
    }
  }, [])

  return number
}

export function Loader({ message = '', size = 'page', className = '' }) {
  const number = useScoreboardNumber()

  return (
    <div className={`loader loader--${size} ${className}`.trim()} role="status" aria-live="polite">
      <div className="loader__stage" aria-hidden="true">
        <div className="loader__scoreboard">
          <div className="loader__league">NATIONAL</div>
          <span className="loader__colhead" />
          <span className="loader__colhead" />
          <span className="loader__colhead">1</span>
          <span className="loader__colhead">2</span>
          <span className="loader__colhead">3</span>

          <span className="loader__num">32</span>
          <span className="loader__team">MILWAUKEE</span>
          <span className="loader__score">0</span>
          <div className="loader__plate-window">
            <span className="loader__plate" key={number}>{number}</span>
          </div>
          <span className="loader__blank" />

          <span className="loader__num">18</span>
          <span className="loader__team">CUBS</span>
          <span className="loader__score">0</span>
          <span className="loader__score">0</span>
          <span className="loader__blank" />
        </div>
      </div>
      {message && <span className="loader__label">{message}</span>}
    </div>
  )
}
