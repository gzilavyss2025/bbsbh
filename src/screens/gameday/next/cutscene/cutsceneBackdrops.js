// Backdrops: everything behind the batter, rows 0..95, as slot indices. Each is (b, k, t) with k from
// beatsAt. `night` is the "Night Game" direction Gary picked; `dusk` and `chunky` are the two other
// directions from the design canvas, kept so a scene can pick a different stage.
import { BAND, C, W, put, rect } from './cutsceneArt.js'

const hash = (a, b, c) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0)

// The wall's lit cap, padded face with seams, dark base, then the warning track with flecks.
function wallAndTrack(b, top, seam = 0) {
  rect(b, 0, top, W - 1, top + 1, C.wallLit)
  rect(b, 0, top + 2, W - 1, 79, C.wall)
  for (let x = seam; x < W; x += 32) rect(b, x, top + 2, x, 79, C.wallDeep)
  rect(b, 0, 80, W - 1, 80, C.wallDeep)
  rect(b, 0, 81, W - 1, BAND - 1, C.dirt)
  for (let y = 82; y < BAND; y += 3) for (let x = (y * 5) % 7; x < W; x += 7) put(b, x, y, C.dirtLit)
}

// Night: a brick of 6 x 8 fan cells, head over shoulders, two body tones by cell, the back three rows
// in shadow. After the cut a third of the lower fans stand (one pixel up), rotating with k.wave.
function night(b, k) {
  for (let y = 0; y < 56; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor(y / 8), xs = x + (row & 1) * 3, xx = xs % 6, cell = Math.floor(xs / 6)
    const up = k.wave >= 0 && row >= 3 && (cell + row * 2 + k.wave) % 3 === 0 ? 1 : 0, yy = (y % 8) + up
    const back = row < 3, body = back ? (cell & 1 ? C.crowd1 : C.night) : (cell + row) & 1 ? C.crowd2 : C.crowd1
    let c = C.night
    if (yy >= 1 && yy <= 2 && xx >= 2 && xx <= 3) c = back ? C.crowd2 : (cell * 3 + row) % 4 === 0 ? C.crowd3 : C.crowd4
    else if (yy >= 3 && yy <= 6 && xx >= 1 && xx <= 4) c = body
    else if (yy >= 4 && yy <= 6 && (xx === 0 || xx === 5)) c = body
    if (!back && yy === 0 && xx === 0 && hash(cell, row, k.wave) % 9 === 2) c = C.chalk   // flashbulbs
    put(b, x, y, c)
  }
  wallAndTrack(b, 56)
}

// Dusk: a sunset in three bands, a light tower, two tiers of fans as silhouettes with a rail between.
function dusk(b, k) {
  rect(b, 0, 0, W - 1, 11, C.dusk1); rect(b, 0, 12, W - 1, 23, C.dusk2); rect(b, 0, 24, W - 1, 33, C.dusk3)
  rect(b, 160, 2, 173, 6, C.outline); rect(b, 166, 7, 167, 33, C.outline)
  for (const x of [162, 165, 168, 171]) put(b, x, 4, C.chalk)
  const wave = Math.max(0, k.wave)
  for (let x = 0; x < W; x++) {
    const top = 34 + ((x >> 2) & 1) * 2 + (((x + 2) >> 3) & 1)
    for (let y = top; y < 47; y++) put(b, x, y, C.crowd1)
    if (((x >> 2) + wave) % 6 === 1 && (x & 3) <= 1) for (let y = top - 4; y < top; y++) put(b, x, y, C.crowd1)   // arms up
  }
  rect(b, 0, 47, W - 1, 47, C.crowd3)
  for (let x = 0; x < W; x++) {
    const top = 49 + (((x + 3) >> 2) & 1) * 2 + (((x + 5) >> 3) & 1)
    for (let y = top; y < 62; y++) put(b, x, y, C.crowd2)
    if ((((x + 3) >> 2) + wave) % 5 === 2 && ((x + 3) & 3) <= 1) for (let y = top - 4; y < top; y++) put(b, x, y, C.crowd2)
    if (((x + 3) >> 2) % 7 === 3 && ((x + 3) & 3) === 1) put(b, x, top, C.crowd3)   // a lit head
  }
  wallAndTrack(b, 62, 16)
}

// Chunky: the stands on a 96 x 28 grid of 2 x 2 blocks, a checker of fans with a rail every eight rows.
function chunky(b, k) {
  const g = (x, y, c) => rect(b, x * 2, y * 2, x * 2 + 1, y * 2 + 1, c)
  for (let y = 0; y < 28; y++) for (let x = 0; x < 96; x++) {
    let c = ((x >> 1) + (y >> 1)) & 1 ? C.crowd2 : C.crowd1
    if (y % 8 === 7) c = C.crowd3
    if (y % 8 === 1 && (x * 5 + y) % 9 === 0) c = C.crowd4
    if (y % 8 === 3 && hash(x, y, Math.max(0, k.wave)) % 23 === 0) c = C.chalk
    g(x, y, c)
  }
  wallAndTrack(b, 56)
}

export const BACKDROPS = { night, dusk, chunky }
