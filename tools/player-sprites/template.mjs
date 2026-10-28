// Original vector artwork. Coordinates are in a 160 × 200 authoring space.
export const palette = {
  jersey: '#f5f1e5', pants: '#deded8', cap: '#183b64', trim: '#c69632',
  socks: '#183b64', shoes: '#242629', belt: '#503b2a', skin: '#bb8059',
  glove: '#946137', bat: '#c49b64', gear: '#183b64', outline: '#282723',
}

// Each limb has shoulder/hip, elbow/knee, and hand/foot coordinates.
// These are standing poses, including the catcher between pitches.
export const poses = {
  catcher: { arms: [[59,76,48,100,53,119],[101,76,113,99,108,116]], legs: [[69,122,61,150,54,183],[91,122,99,150,107,183]], glove: [51,118], gear: true },
  infielder: { arms: [[59,76,45,98,68,117],[101,76,113,98,89,117]], legs: [[69,122,60,151,49,183],[91,122,102,151,115,183]], glove: [76,117] },
  outfielder: { arms: [[59,76,48,103,45,125],[101,76,112,102,115,124]], legs: [[69,122,67,151,64,183],[91,122,94,151,98,183]], glove: [43,125] },
  pitcher: { arms: [[59,76,53,95,79,88],[101,76,107,95,83,88]], legs: [[69,122,72,151,71,183],[91,122,92,151,94,183]], glove: [80,88] },
  'bat-right': { arms: [[59,76,48,91,102,70],[101,76,116,91,105,73]], legs: [[69,122,56,151,49,183],[91,122,102,151,114,183]], bat: [105,72,123,17] },
  'bat-left': { mirror: 'bat-right' },
}

function number(value, fallback, min, max) {
  const n = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Expected a number from ${min} to ${max}`)
  return n
}

export function renderSprite(config = {}, poseName = 'infielder') {
  if (!Object.hasOwn(poses, poseName)) throw new Error(`Unknown pose: ${poseName}`)
  const colors = { ...palette, ...config.colors }
  for (const [key, value] of Object.entries(colors)) {
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid hex color: ${key}`)
  }
  const height = number(config.heightInches, 72, 54, 84)
  const weight = number(config.weightPounds, 195, 100, 350)
  // Height scales the figure up and down; weight alone sets its width (the square root keeps a heavy
  // build from ballooning). A taller player at the same weight reads leaner.
  const sy = height / 72
  const sx = Math.sqrt(weight / 195)
  const mirror = poses[poseName].mirror
  const pose = { ...poses[mirror || poseName], ...config.poses?.[poseName] }
  for (const key of ['arms', 'legs']) {
    if (!Array.isArray(pose[key]) || pose[key].length !== 2 || pose[key].some(limb =>
      !Array.isArray(limb) || limb.length !== 6 || limb.some(n => !Number.isFinite(n) || n < 0 || n > 200))) {
      throw new Error(`Invalid ${key} coordinates for ${poseName}`)
    }
  }
  for (const key of ['glove', 'bat']) {
    if (pose[key] && (!Array.isArray(pose[key]) || pose[key].length !== (key === 'bat' ? 4 : 2) || pose[key].some(n => !Number.isFinite(n) || n < 0 || n > 200))) throw new Error(`Invalid ${key} coordinates`)
  }
  const c = colors
  const line = (coords, color, width) => `<polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  const limb = (coords, color, width) => line(coords, c.outline, width + 2) + line(coords, color, width)
  const legs = pose.legs.map(p => limb(p, c.pants, 16) + limb(p.slice(2), c.socks, 9) + limb([p[4]-5,p[5],p[4]+7,p[5]], c.shoes, 8)).join('')
  const arms = pose.arms.map(p => limb(p, c.skin, 10) + limb(p.slice(0,4), c.jersey, 14) + line(p.slice(0,4), c.trim, 2)).join('')
  const gear = pose.gear ? `<g id="catcher-gear" fill="${c.gear}"><path d="M65 74H95L100 113H60Z"/><path d="M54 151h15v24H54zM94 151h15v24H94z"/></g>` : ''
  const bat = pose.bat ? `<g id="bat">${limb(pose.bat,c.bat,6)}</g>` : ''
  const glove = pose.glove ? `<ellipse id="glove" cx="${pose.glove[0]}" cy="${pose.glove[1]}" rx="10" ry="12" fill="${c.glove}" stroke="${c.outline}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="256" viewBox="0 0 192 256" role="img" aria-label="${poseName} baseball player">
<title>${poseName} — ${height} in, ${weight} lb</title>
<g transform="translate(96 238) scale(${sx} ${sy}) translate(-80 -187)">
<g transform="${mirror ? 'translate(160 0) scale(-1 1)' : 'translate(0 0)'}" stroke="${c.outline}" stroke-width="2">
<g id="legs">${legs}</g>
<path id="jersey" d="M60 70Q80 62 100 70L105 119Q80 130 55 119Z" fill="${c.jersey}"/>
<path id="piping" d="M80 69V120M60 73L80 83L100 73" fill="none" stroke="${c.trim}" stroke-width="3"/>
<path id="belt" d="M57 120Q80 125 103 120" fill="none" stroke="${c.belt}" stroke-width="5"/>
${gear}${bat}<g id="arms">${arms}</g>${glove}
<path id="neck" d="M73 59h14v14H73Z" fill="${c.skin}"/>
<ellipse id="head" cx="80" cy="48" rx="15" ry="19" fill="${c.skin}"/>
<path id="cap" d="M64 44Q62 24 80 25Q98 25 96 44ZM65 43h37v5H65Z" fill="${c.cap}"/>
<path d="M86 49v5m-12-5v5" stroke="${c.outline}"/>
${pose.gear ? `<path id="mask" d="M65 45h30v18H65ZM65 53h30M75 45v18M85 45v18" fill="none" stroke="${c.gear}" stroke-width="3"/>` : ''}
</g></g></svg>`
}
