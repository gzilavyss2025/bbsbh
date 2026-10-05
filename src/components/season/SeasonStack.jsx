import { SectionHead } from '../ui/frame/SectionHead.jsx'

// TWO SEASONS, ONE ABOVE THE OTHER (#1202): a player card's compare view
// (#1199, question 3). A board compares many men in a change column; one man's
// card stacks his seasons, each under its own year, the same card drawn twice.
//
// `seasons` is [{ year, body }], the shown season first. A season with no body
// (a 2027 rookie's 2026) prints the card's empty line, `empty`, never zeros.
export function SeasonStack({ seasons, empty }) {
  return seasons.map(({ year, body }) => (
    <section key={year}>
      <SectionHead as="h4">{year}</SectionHead>
      {body ?? (
        <p className="hint">
          {empty} in {year}.
        </p>
      )}
    </section>
  ))
}
