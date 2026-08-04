import { useId, useState } from 'react'

// The collapsible section a team-hub tab uses for its SECONDARY modules, so a
// tab never becomes another wall of full-height cards. Closed, it is one row
// carrying the module's title and its headline figure ("Injured · 4"); open, it
// renders the module itself.
//
// `children` is a RENDER FUNCTION, invoked only while open — so a shelf's
// contents, and any fetch they kick off, cost nothing until someone opens it.
// That is the same shape SealBox.jsx uses, and it is borrowed for the same
// mechanical reason (don't build what nobody asked for), NOT as a spoiler
// mechanism: nothing on the team page is sealed, and a shelf must never be
// described or relied on as a seal. If you need a real seal, use SealBox.
//
// Open/closed state is keyed by team id, the idiom TeamPage already uses for
// its prospects/injured expanders: client-side navigation to another club then
// naturally starts from `defaultOpen` instead of inheriting the last club's
// state, with no prop-syncing effect.
export function TeamShelf({ teamId, title, summary, defaultOpen = false, children }) {
  // The last explicit toggle, remembered WITH the club it was made on — a bare
  // boolean would carry one club's open shelf onto the next club's page.
  const [toggled, setToggled] = useState(null) // { teamId, open }
  const open = toggled?.teamId === teamId ? toggled.open : defaultOpen
  const panelId = useId()

  return (
    <section className={`teamshelf ${open ? 'is-open' : ''}`.trim()}>
      <button
        type="button"
        className="teamshelf__row"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setToggled({ teamId, open: !open })}
      >
        <span className="teamshelf__title">{title}</span>
        {summary != null && summary !== '' && (
          <span className="teamshelf__sum mono">{summary}</span>
        )}
        <span className="teamshelf__chev" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div className="teamshelf__body" id={panelId}>
          {children()}
        </div>
      )}
    </section>
  )
}
