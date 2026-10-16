// The letter each pitch-dot category wears in the pitch list (C called, S swinging,
// F foul, X in play, B ball), so a call never rests on colour alone (#2213). Pure
// lookup on the category string; it reads no feed and no score.
export const PITCH_CAT_LETTER = { called: 'C', whiff: 'S', foul: 'F', inplay: 'X', ball: 'B' }
