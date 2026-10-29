// What a manager fill-in prints, as plain data, so the lineup page's Manager cell and the extras
// panel's club rows read one shape (ManagerFact.jsx draws it). Spoken order, not surname-first:
// "Kevin Cash 16": the number bare, no "#" (Gary, 2026-10-29); it is '' when the feed has no number (fetchManager
// answers '' there, never a bare number). `photo` is whether a coach photo can be asked for at
// all, which needs a personId (an older feed or a thin MiLB one has none).
export function managerFactParts(manager) {
  if (!manager) return null
  return {
    personId: manager.personId ?? null,
    name: manager.name,
    jersey: manager.jersey ? String(manager.jersey) : '',
    interim: Boolean(manager.interim),
    photo: Boolean(manager.personId),
  }
}
