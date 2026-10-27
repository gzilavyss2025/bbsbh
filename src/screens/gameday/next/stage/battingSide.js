// Pre-game switch hitters stand opposite the pitcher's throwing hand. Unknown sides use R,
// matching the overhead field's default; both the field and plate inset share this resolution.
export const battingSide = (batSide, pitchHand) => batSide === 'S' ? (pitchHand === 'L' ? 'R' : 'L') : batSide === 'L' ? 'L' : 'R'
