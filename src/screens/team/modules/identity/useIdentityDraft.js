import { useCallback, useEffect, useMemo, useState } from 'react'
import { identityOverrides, setIdentityPreview } from '../../../../lib/identity/overlay.js'
import { parseIdentityFieldId } from '../../../../lib/identity/fields.js'

// The unsaved state of one club's identity while the owner is editing it.
//
// DELIBERATELY KNOWS NOTHING ABOUT CLERK, saving, or which fields exist. It is
// called unconditionally by TeamHubShell — for every visitor, admin or not — so
// it must be safe on a deploy with no ClerkProvider mounted, and it must not
// drag the editor's field catalog (and through it the WPA and stamp modules)
// into the team hub's chunk for people who will never open a drawer. Everything
// that needs a token is in IdentityAdminBar.jsx; everything that needs the field
// list is in that file and IdentityDrawer.jsx, both lazy. Same split
// useBallparkDraft keeps, and for the same two reasons.
//
// THE DRAFT IS THE PREVIEW. Values are pushed into the overlay's render-only
// layer while editing (src/lib/identity/overlay.js), so the header, the tiles
// and the stamps on this page repaint through the SAME resolvers a visitor
// reads. There is deliberately no second render path and no editor-only mock:
// the club's own page is what the tuning is judged against, which is the whole
// argument for a gear here rather than a row in /identity-lab.
//
// THE DRAFT CARRIES ITS OWN CLUB ID, and a draft for another club is DERIVED
// away rather than cleared in an effect. `/team/{id}` can swap clubs under a
// mounted shell (the browse strip does exactly that), and resetting state from
// an effect means one render where a Brewers draft is painting over Cincinnati's
// header. Deriving it is both correct on the first render and free.

const EMPTY = { editing: false, values: {}, saved: {}, treatment: null, status: { busy: false, error: '' } }

// This club's ids out of the persisted override map. Cheap enough to redo on
// demand — a map holding an override for every club would still be a few
// hundred keys.
function overridesFor(teamId) {
  const want = String(teamId)
  const out = {}
  for (const [id, value] of Object.entries(identityOverrides())) {
    if (parseIdentityFieldId(id)?.teamId === want) out[id] = value
  }
  return out
}

export function useIdentityDraft(teamId) {
  // One object rather than six pieces of state, so the club id it belongs to
  // travels with it and cannot be checked for in one place and forgotten in
  // another.
  const [held, setHeld] = useState({ teamId, ...EMPTY })
  const draft = held.teamId === teamId ? held : { teamId, ...EMPTY }

  const patch = useCallback(
    (next) => setHeld((prev) => ({ ...(prev.teamId === teamId ? prev : { teamId, ...EMPTY }), ...next, teamId })),
    [teamId],
  )

  const start = useCallback(() => {
    // The club's already-stored overrides become the starting draft, so the
    // boxes open showing what is landed rather than blank.
    const current = overridesFor(teamId)
    patch({ editing: true, values: current, saved: current, status: { busy: false, error: '' } })
  }, [patch, teamId])

  const cancel = useCallback(() => patch(EMPTY), [patch])

  // Adopt what the server stored, so the draft stops being unsaved — otherwise
  // Cancel would later revert to the values this edit replaced.
  const commit = useCallback(() => patch(EMPTY), [patch])

  const setValue = useCallback(
    (id, value) =>
      setHeld((prev) => {
        const base = prev.teamId === teamId ? prev : { teamId, ...EMPTY }
        // '' is kept rather than deleted: an empty box is a real edit meaning
        // "clear this override back to what ships", and dropping the key would
        // make it indistinguishable from never having touched the field.
        return { ...base, teamId, values: { ...base.values, [id]: value } }
      }),
    [teamId],
  )

  const setStatus = useCallback((status) => patch({ status }), [patch])
  const setTreatment = useCallback((treatment) => patch({ treatment }), [patch])

  // Paint the draft, and stop painting it when editing ends, the club changes,
  // or this page unmounts. The overlay ignores a preview identical to the one it
  // already holds, so this settles rather than looping.
  const { editing, values } = draft
  useEffect(() => {
    setIdentityPreview(editing ? values : {})
  }, [editing, values])

  useEffect(() => () => setIdentityPreview({}), [])

  const dirty = useMemo(() => {
    const ids = new Set([...Object.keys(draft.values), ...Object.keys(draft.saved)])
    return [...ids].some((id) => (draft.values[id] || '') !== (draft.saved[id] || ''))
  }, [draft.values, draft.saved])

  return { ...draft, dirty, start, cancel, commit, setValue, setStatus, setTreatment }
}
