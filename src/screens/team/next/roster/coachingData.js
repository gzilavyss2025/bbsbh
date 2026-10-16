// The Coaching staff card's position line: the coaches fully in view, out of the whole staff.
// "1–2 of 16", or "3 of 16" when one fills the view.
export const rangeLabel = (first, last, total) => `${first === last ? first : `${first}–${last}`} of ${total}`
