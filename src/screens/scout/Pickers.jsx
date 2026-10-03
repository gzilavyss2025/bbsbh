import { useState } from 'react'
import { SiteSearchModal } from '../../components/chrome/SiteSearch.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { canHit, canPitch } from '../../lib/scout/roles.js'

const SLOTS = {
  pitcher: { label: 'Pitcher', pick: 'Pick a pitcher', placeholder: 'Search pitchers', accept: canPitch },
  hitter: { label: 'Hitter', pick: 'Pick a hitter', placeholder: 'Search hitters', accept: canHit },
}

// THE TWO PICKERS (#1410). Each slot is a button that opens the site search in
// pick mode (components/chrome/SiteSearch.jsx), so the pickers keep its
// keyboard-safe surface (ADR-0037) rather than a second search box. The
// pitcher box lists pitchers, the hitter box everyone else; a two-way player
// is in both (lib/scout/roles.js).
//
// `pitcher` and `hitter` are the current picks ({ id, name } or null).
// `onPick(role, person)` fires with the search row; the page decides when the
// pair is complete and where to go.
export function Pickers({ pitcher, hitter, onPick }) {
  const [open, setOpen] = useState(null)
  const picks = { pitcher, hitter }
  return (
    <div className="scout__pickers">
      {Object.entries(SLOTS).map(([role, slot]) => (
        <div key={role} className="scout__picker">
          <span className="scout__controllabel">{slot.label}</span>
          <Button size="control" className="scout__pickbtn" onClick={() => setOpen(role)}>
            {picks[role]?.name || slot.placeholder}
          </Button>
        </div>
      ))}
      {open && (
        <SiteSearchModal
          onClose={() => setOpen(null)}
          pick={{
            label: SLOTS[open].pick,
            placeholder: SLOTS[open].placeholder,
            accept: SLOTS[open].accept,
            onPick: (person) => onPick(open, person),
          }}
        />
      )}
    </div>
  )
}
