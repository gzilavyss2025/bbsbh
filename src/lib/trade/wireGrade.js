// The transaction wire's trade grade, set the way a paper's transactions
// column would: the trade's sentence stays the news, and the grade runs as its
// own labelled line under the player notes, winner first, nicknames, no
// adjectives, a caveat after a semicolon. Pure: the sides come from the
// story's cutline here, the dollars from api/trade/wireGrade.js.

// Who went which way in a wire trade sentence: "Acquired 1B Royce Lewis from
// the Minnesota Twins for C Francisco Espinoza and RHP Bobby Miller." The
// players before "for" came to the story's club; the club named in the
// sentence sent them, and the players after "for" went to it. Null when the
// sentence has no other club (not a trade between two clubs).
export function tradeParties(story) {
  const segs = story?.cutline ?? []
  const got = []
  const gave = []
  let otherId = null
  let after = false
  for (const seg of segs) {
    if (seg.playerId) (after ? gave : got).push(Number(seg.playerId))
    else if (seg.teamId && otherId == null) otherId = Number(seg.teamId)
    else if (otherId != null && /\bfor\b/i.test(seg.text ?? '')) after = true
  }
  if (otherId == null || story?.teamId == null || !got.length) return null
  const text = segs.map((s) => s.text ?? '').join('')
  return {
    clubId: Number(story.teamId),
    otherId,
    got,
    gave,
    cash: /\bcash\b/i.test(text),
    toBeNamed: /to be named/i.test(text),
  }
}

// "Grades: Dodgers A, Twins C." Winner first (a tie keeps the story's club
// first); the caveat that the grade could not count runs after a semicolon.
export function gradeLine({ club, other, valueUsd, cash = false, toBeNamed = false }, gradeOf) {
  const sides = [{ name: club, grade: gradeOf(valueUsd), v: valueUsd }, { name: other, grade: gradeOf(-valueUsd), v: -valueUsd }]
  if (sides[1].v > sides[0].v) sides.reverse()
  const caveat = toBeNamed ? 'a player is still to be named' : cash ? "the cash wasn't reported" : null
  return `${sides.map((s) => `${s.name} ${s.grade}`).join(', ')}${caveat ? `; ${caveat}` : ''}.`
}
