// Pure, deterministic pixel effects: scrub, replay and reduced motion share a frame.
// No random state, timers, gradients or per-frame image preparation.
export function drawEffects(g, time, track, colors = {}) {
  const elapsed = time - track.accentAt
  if (!track.effect || elapsed < 0) return
  const end = track.duration - track.accentAt
  const fade = Math.min(1, elapsed / 0.12) * Math.min(1, (end - elapsed) / 0.35)
  if (fade <= 0) return
  g.save()
  g.globalAlpha = fade
  const ink = [colors.trim || colors.chalk || '#e4bc57', colors.helmet || '#58a9dd', colors.chalk || '#fff0cf']
  if (track.effect === 'confetti') {
    for (let i = 0; i < 64; i++) {
      const x = (i * 137 + Math.round(Math.sin(elapsed * 2 + i) * 18)) % 768
      const y = -100 + (i * 67 % 380) + elapsed * (50 + i % 30)
      g.fillStyle = ink[i % ink.length]
      g.fillRect(x, Math.round(y), i % 2 ? 4 : 8, i % 2 ? 8 : 4)
    }
  } else if (track.effect === 'fireworks' || track.effect === 'starburst') {
    const bursts = track.effect === 'fireworks' ? [[190, 105, 0], [615, 95, 0.25], [295, 190, 0.5]] : [[490, 205, 0]]
    bursts.forEach(([x, y, delay], b) => {
      const age = elapsed - delay
      if (age < 0 || age > 1.4) return
      g.globalAlpha = fade * (1 - age / 1.4)
      g.fillStyle = ink[b % ink.length]
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6
        for (let j = 0; j < 4; j++) {
          const radius = 12 + age * 80 + j * 6
          g.fillRect(Math.round(x + Math.cos(angle) * radius), Math.round(y + Math.sin(angle) * radius + age * age * 15), 4, 4)
        }
      }
    })
  } else if (track.effect === 'sparkles') {
    for (let i = 0; i < 9; i++) {
      const age = elapsed - i * 0.04
      if (age < 0 || age > 0.8) continue
      const x = 350 + i * 37 % 270, y = 65 + i * 53 % 200
      const arm = Math.round(3 + Math.sin(age / 0.8 * Math.PI) * 6)
      g.globalAlpha = fade * (1 - age / 0.8)
      g.fillStyle = ink[i % ink.length]
      g.fillRect(x - arm, y - 1, arm * 2 + 2, 3)
      g.fillRect(x - 1, y - arm, 3, arm * 2 + 2)
    }
  }
  g.restore()
}

export function hopOffset(time, hop) {
  if (!hop || time <= hop.start || time >= hop.end) return 0
  const fraction = time <= hop.apex ? (time - hop.start) / (hop.apex - hop.start) : (hop.end - time) / (hop.end - hop.apex)
  return -Math.round(hop.height * Math.sin(fraction * Math.PI / 2))
}
