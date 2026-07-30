import { monthDayYear } from '../../../lib/dates.js'

// The dates this club actually wore this jersey, as ticket-stub links into that
// game's photo gallery (`/photos/{gamePk}` — GamePhotosPage, deep-linked), each
// opening its own new tab — checking a hex against a real photo is a
// side-by-side task, and a same-tab navigation would lose the bench you're
// comparing it against. The swatches say what a jersey is SUPPOSED to look
// like; this is how you check that against a photograph of the real uniform,
// which is the only source that settles an argument about a hex.
//
// Most-recent first and capped (see jerseyWearDates) — a club wears one jersey
// far too often for a full list to be a glance. `dates` is null while the
// join's two halves are still loading, [] for a jersey with no posted wear yet
// (a brand-new jersey, or any MiLB bench — that feed doesn't exist).
//
// The gallery it links to is deliberately NOT spoiler-safe and says so on its
// own page: a celebration photo narrates the result. That's an existing,
// consented property of that page, and this is a dev-only lab, so the link goes
// straight there rather than growing a second warning.
export function WearDates({ dates, hrefFor, name, label }) {
  return (
    <div className="idlab__section">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Worn</span>
      </div>
      {dates == null ? (
        <p className="colorlab__weardates-hint">Loading worn dates…</p>
      ) : dates.length === 0 ? (
        <p className="colorlab__weardates-hint">No posted wear this season.</p>
      ) : (
        <div className="colorlab__weardates-list">
          {dates.map((d) => (
            <a
              key={d.gamePk}
              className="idlab__stub"
              href={hrefFor(d.gamePk)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open the game photos for ${name} — ${label}, ${monthDayYear(d.apiDate)} in a new tab`}
            >
              {monthDayYear(d.apiDate)}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
