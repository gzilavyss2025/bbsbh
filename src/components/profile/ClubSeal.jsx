import { TeamLogo } from '../logo/TeamLogo.jsx'

// The club seal — a wax/rubber-stamp roundel around the club you follow. It is
// My Tally's identity mark and it is identity ONLY: its single input is a
// teamId, which is a fact about you, never about a game. It reads no schedule,
// no feed, and no collection, and there is nothing about it that could learn to.
//
// The mark inside is `TeamLogo`'s `mono` knockout variant — the one-color art
// precomputed per club by scripts/gen-mono-logos.mjs (ADR-0031). NOT
// `filter: brightness(0) invert(1)`: that is what the knockout art replaced, and
// it flattens every mark whose interior detail is drawn in a light fill into an
// unreadable blob. A club with no knockout art yet falls back to its full-colour
// mark on its own (see TeamLogo's fallback chain), which is the right degrade.
//
// The ring, its ticks and the two diamonds are drawn here in CSS/SVG rather than
// shipped as an asset, so the seal inherits the paper-and-ink tokens and costs
// no bytes.
export function ClubSeal({ teamId, name, size = 96 }) {
  return (
    <span className="clubseal" style={{ width: size, height: size }}>
      <svg className="clubseal__ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="clubseal__circle" cx="50" cy="50" r="47" />
        <circle className="clubseal__circle clubseal__circle--inner" cx="50" cy="50" r="41" />
        {/* Twelve ticks around the rim — the pressed edge of a rubber stamp. */}
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            className="clubseal__tick"
            x1="50"
            y1="3"
            x2="50"
            y2="8"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <path className="clubseal__diamond" d="M50 12 58 20 50 28 42 20Z" />
        <path className="clubseal__diamond" d="M50 72 58 80 50 88 42 80Z" />
      </svg>
      <span className="clubseal__mark">
        <TeamLogo teamId={teamId} name={name} variant="mono" size={Math.round(size * 0.42)} />
      </span>
    </span>
  )
}
