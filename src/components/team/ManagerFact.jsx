import { Headshot } from '../player/Headshot.jsx'
import { ManagerLink } from './ManagerLink.jsx'
import { managerFactParts } from './managerFactParts.js'

// The manager fill-in, shared by the lineup page's Manager cell and the extras panel's club rows:
// his headshot (the coach photo, framed like a lineup row's shot; no photo on file draws
// nothing), then first name, last name and the uniform number "#30" inked in seam red, and an
// interim appointment marked. Null (→ the Fact's "—") until resolved. Linked to his manager page
// once fetchManager resolves a personId (older cached data / a fetch that raced ahead of that
// field lands here without one — ManagerLink degrades to plain text rather than a dead link).
// The name is `name`, spoken order, which is also what the address takes (ADR-0057).
export function managerFact(manager) {
  const m = managerFactParts(manager)
  if (!m) return null
  return (
    <ManagerLink id={m.personId} name={m.name} className="fact__person">
      {m.photo ? <Headshot personId={m.personId} name={m.name} coach hideFallback className="fact__shot" /> : null}
      <span className="fact__who">
        {m.name}
        {m.jersey ? (
          <>
            {' '}
            <span className="fact__jersey">{m.jersey}</span>
          </>
        ) : null}
      </span>
      {m.interim ? <span className="fact__note">interim</span> : null}
    </ManagerLink>
  )
}
