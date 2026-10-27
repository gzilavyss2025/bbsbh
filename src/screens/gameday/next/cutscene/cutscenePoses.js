// The batter's poses, built at load from one reference grid: the body, head and legs are kept, the
// bat and arms are erased, the chest is rebuilt, and each pose adds its own arms and hands as a few
// polyline points. A new pose is a new entry in POSES (or a buildPose() call from a scene spec), not
// hand-placed pixels. Output rows are KIT letters (cutsceneArt.js), 45 x 49, the belt at WAIST.
//
// REF is the chosen reference sprite transcribed cell by cell (an AI-generated gallery piece, edited
// and recoloured under its licence). Its letters are that image's colours: # background, a/b outline,
// c/d bat, e/g helmet, f red, h/i/j/k skin, l/m dark and mid red, n/o/p pants.
const REF = [
  '..................................................................',
  '.################################################################.',
  '.################################################################.',
  '.################################################################.',
  '.################################################################.',
  '.####################ab##########################################.',
  '.###################bccb#########################################.',
  '.###################bdca#########################################.',
  '.####################aca#########################################.',
  '.####################adca######bbbbaa############################.',
  '.####################adca#####beeeeeea###########################.',
  '.####################bdca#####aeeeeefea##########################.',
  '.#####################bca####agggeeeega##########################.',
  '.#####################bca####agggeeggfffa########################.',
  '.#####################bdcb###agaaaafffaaa########################.',
  '.#####################bdca####abbahbaaa##########################.',
  '.######################aca####aaiajkhha##########################.',
  '.######################acb#####abkjjjja##########################.',
  '.######################adca#aaahhlhjkaa##########################.',
  '.#######################bcaallajkkakkcbll########################.',
  '.#######################acallflhjhkaaamlff#######################.',
  '.#######################bcalbffahjcllfffffa######################.',
  '.#######################aahabfffbaafffbfffa######################.',
  '.#######################aijjalfffbfffaffflb######################.',
  '.######################bjjhhallffffflnooema######################.',
  '.######################bjhkhalllfffflabboaa######################.',
  '.######################ahjjaaalllfflbkhhapa######################.',
  '.######################ahkbjjalllllahjjkha#######################.',
  '.#######################aaiijjaaajjjjjjhhb#######################.',
  '.########################alkjjajjjjjiihha########################.',
  '.#########################blhhahhhhhhhba#########################.',
  '.##########################alallllllaaa##########################.',
  '.###########################aaaaaaaaala##########################.',
  '.###########################alnenaapplna#########################.',
  '.##########################anlnnppppenppb########################.',
  '.##########################anlooooopeepppa#######################.',
  '.##########################anlopppppppppppbb#####################.',
  '.##########################anfooooppeppppoonb####################.',
  '.##########################alooooppapppppooopb###################.',
  '.##########################aloooonaappppppooopa##################.',
  '.#########################bomooopa##bbbppppooopb#################.',
  '.#########################bfoooopb####bbapppoopa#################.',
  '.#########################afooopa#######aaaeeopa#################.',
  '.########################eomoopna#########bgpppb#################.',
  '.#######################bimooopa#########bpppppb#################.',
  '.######################bomooopp##########aapppa##################.',
  '.#####################baloooppa##########aaaaa###################.',
  '.#####################bfgopppb###########allla###################.',
  '.####################bfggeppa############aaaaa###################.',
  '.###################befggabb#############agga####################.',
  '.###################aeglaa###############agga####################.',
  '.##################agggb################kaggab###################.',
  '.#################aeeaajikkkkkkkkkkkkkkkagaaeaaa#################.',
  '.################agegbjjjjkkkkkkkdkdkkkkaggeeegabk###############.',
  '.#############jjjagegahkkkkkkkkkkkkkkkkkaaaagggggajjj############.',
  '.###########jjjjjageeebkkkkkkkkkkkkkjjjkkkkabaaaabjjjjj##########.',
  '.###########jjjjjjaeaaaakkjjjjjjjjjjjjjjjjjjjjjjjjjjjjj##########.',
  '.#############jjjjbeeeeakjjjjjjkjkjjjjkkjjjjjjjjjjjjj############.',
  '.################jjaaaaajjjjjjjjkjhjjjjjjjjjjjjjjjj##############.',
  '.#####################jjjjjjjjjjjjjjjjjjjjjjjjj##################.',
]
const JOB = { '#': '.', a: 'K', b: 'K', j: 'S', k: 's', h: 'd', i: 'S', e: 'H', g: 'h', f: 'J', l: 'j', m: 'm', o: 'P', p: 'p', n: 'n', c: 'W', d: 'w' }
const CROP = { x0: 6, x1: 50, y0: 3, y1: 51 }
export const WAIST = 28

// spec: { near, far: polylines [[x, y], ...] from the shoulder; nearHand, farHand: 'fist' | 'fistDown' | 'pointLeft';
//         farBehind: paint the far arm behind the chest; cuff: sleeve length in cells (default 5) }
export function buildPose({ near, far, nearHand, farHand, farBehind = false, cuff = 5 }) {
  const G = REF.map((r) => r.split(''))
  const W = G[0].length, H = G.length
  const at = (x, y) => (G[y] && G[y][x]) || '#'
  const set = (x, y, c) => { if (y >= 0 && y < H && x >= 0 && x < W) G[y][x] = c }
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c) }
  const painted = new Set()
  const paint = (x, y, c) => { set(x, y, c); painted.add(x + ',' + y) }
  const outline = () => {
    for (const key of painted) { const [x, y] = key.split(',').map(Number); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === '#') set(x + dx, y + dy, 'a') }
    painted.clear()
  }
  // Erase the bat, the arms, the hands, the chest block and the ground.
  rect(19, 4, 27, 23, '#'); rect(22, 19, 42, 29, '#'); rect(0, 52, W - 1, H - 1, '#')
  // An arm: a polyline from the shoulder, three wide; the first `cuff` cells are sleeve, the rest skin.
  const arm = (pts, shadeSide, hand) => {
    const cells = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let s = i ? 1 : 0; s <= n; s++) cells.push([Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n)])
    }
    const vertical = Math.abs(pts[pts.length - 1][1] - pts[0][1]) >= Math.abs(pts[pts.length - 1][0] - pts[0][0])
    cells.forEach(([cx, cy], i) => {
      const sleeve = i < cuff, cuffRow = i === cuff
      for (let d = -1; d <= 1; d++) {
        const c = cuffRow ? 'l' : sleeve ? (d === shadeSide ? 'l' : 'f') : d === shadeSide ? 'k' : 'j'
        if (vertical) paint(cx + d, cy, c); else paint(cx, cy + d, c)
      }
    })
    const [wx, wy] = cells[cells.length - 1]
    if (hand === 'fist') {          // four wide, four tall above the wrist, the knuckle row at the bottom
      const x0 = shadeSide > 0 ? wx - 2 : wx - 1
      for (let dy = -4; dy <= -1; dy++) for (let dx = 0; dx <= 3; dx++) paint(x0 + dx, wy + dy, dy === -1 ? 'h' : (shadeSide > 0 ? dx === 3 : dx === 0) ? 'k' : 'j')
    } else if (hand === 'fistDown') { // hanging, four wide, four tall below the wrist
      for (let dy = 1; dy <= 4; dy++) for (let dx = 0; dx <= 3; dx++) paint(wx - 2 + dx, wy + dy, dy === 4 ? 'h' : dx === 3 ? 'k' : 'j')
    } else if (hand === 'pointLeft') { // a hand with the index finger out to the left, the thumb tucked
      for (let dy = -1; dy <= 1; dy++) for (let dx = -3; dx <= 0; dx++) paint(wx + dx, wy + dy, dy === 1 ? 'h' : 'j')
      for (let dx = -7; dx <= -4; dx++) paint(wx + dx, wy - 1, 'j')
      paint(wx - 3, wy + 2, 'h'); paint(wx - 2, wy + 2, 'h')
    }
  }
  if (farBehind) { arm(far, 1, farHand); outline() }
  // The chest: fill between the shoulders, shade on the viewer's left, a lighter column at the right, a V neck.
  for (let y = 19; y <= 29; y++) { rect(27, y, 41, y, 'f'); set(27, y, 'a'); set(41, y, 'a'); set(28, y, 'l'); set(29, y, y >= 24 ? 'l' : 'f'); set(40, y, 'm') }
  rect(28, 19, 40, 19, 'a')
  G[19].splice(31, 6, ...'jkkakk'); G[19][30] = 'a'; G[19][37] = 'a'
  G[20].splice(30, 8, ...'lhjhkkla'); G[21].splice(31, 6, ...'ljhkla'); G[22].splice(32, 4, ...'llla'); G[23][33] = 'l'; G[23][34] = 'l'
  rect(29, 20, 30, 23, 'l'); rect(38, 20, 39, 23, 'm')
  arm(near, -1, nearHand)
  if (!farBehind) arm(far, 1, farHand)
  outline()
  // Crop to the figure and name every colour by its job: the helmet brim, pant stripe and cleats are trim; row 30 is the belt.
  const rows = []
  for (let y = CROP.y0; y <= CROP.y1; y++) {
    let r = ''
    for (let x = CROP.x0; x <= CROP.x1; x++) {
      const c = G[y][x]
      let o = JOB[c] || '.'
      if (c === 'f' && ((y <= 18 && x >= 34 && x <= 40) || y >= 32)) o = 'T'
      if ((c === 'h' && y === 30) || (c === 'l' && y === 31)) o = 'B'
      r += o
    }
    rows.push(r)
  }
  return rows
}

export const POSES = {
  // both fists high: the home-run and grand-slam beat
  up: { near: [[29, 21], [25, 15], [23, 9]], far: [[39, 21], [45, 14], [47, 8]], nearHand: 'fist', farHand: 'fist' },
  // the pump's down-beat: elbows bent, fists three rows lower
  pump: { near: [[29, 21], [25, 17], [24, 12]], far: [[39, 21], [45, 16], [46, 11]], nearHand: 'fist', farHand: 'fist' },
  // the point to the dugout, the far arm hanging; point2 bobs the finger one row
  point: { near: [[29, 21], [23, 21], [16, 19]], far: [[40, 21], [44, 27], [44, 33]], nearHand: 'pointLeft', farHand: 'fistDown', farBehind: true },
  point2: { near: [[29, 21], [23, 21], [16, 20]], far: [[40, 21], [44, 27], [44, 33]], nearHand: 'pointLeft', farHand: 'fistDown', farBehind: true },
}
export const SPR = Object.fromEntries(Object.entries(POSES).map(([n, s]) => [n, buildPose(s)]))
