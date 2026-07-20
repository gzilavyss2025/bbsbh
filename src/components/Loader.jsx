import { useEffect, useState } from 'react'

// Shared loading indicator: a hand-set manual scoreboard plate, with a status
// line to its right ("Stepping up to the plate…" by default). Replaces bare
// "Loading…" hints across the app so every wait reads in the same scorebook
// voice. Decorative art is aria-hidden; the message rides an aria-live status
// region so it is still announced. Reduced-motion users see a resting zero.
//
// `size`:
//   'page'   — full-screen cold-load screens (the default)
//   'inline' — section-level placeholders that sit inside a card/column
function useScoreboardNumber() {
  const [number, setNumber] = useState(0)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer

    function update() {
      window.clearInterval(timer)
      setNumber(0)
      if (!media.matches) {
        timer = window.setInterval(() => setNumber((current) => (current + 1) % 10), 750)
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

export function Loader({ message = 'Stepping up to the plate…', size = 'page', className = '' }) {
  const number = useScoreboardNumber()

  return (
    <div className={`loader loader--${size} ${className}`.trim()} role="status" aria-live="polite">
      <div className="loader__stage" aria-hidden="true">
        <div className="loader__scoreboard">
          <div className="loader__inning-label">INN</div>
          <div className="loader__inning-grid">
            <span>1</span>
            <span>2</span>
            <span>3</span>
          </div>
          <div className="loader__plate-window">
            <span className="loader__plate" key={number}>{number}</span>
          </div>
        </div>
      </div>
      <span className="loader__label">{message}</span>
    </div>
  )
}
