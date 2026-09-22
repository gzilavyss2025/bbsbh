// The round-down moved 224 padding/gap values down one pixel. Any COMMENT that
// quoted one of those values by number is now a claim the file no longer keeps.
// This finds the ones where the number has left the file entirely.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const changed = execSync('git diff --name-only 9a578dcb7..HEAD -- src/styles src/tokens src/screens', {
  encoding: 'utf8',
}).trim().split('\n').filter((f) => f.endsWith('.css') || f.endsWith('.js') || f.endsWith('.jsx'))

// The odd band the sweep rounded down, plus the two it minted around.
const SUSPECT = [5, 7, 9, 11, 13, 15, 7.5]

function splitComments(src) {
  const comments = []
  let code = ''
  let i = 0
  for (;;) {
    const open = src.indexOf('/*', i)
    if (open === -1) { code += src.slice(i); break }
    code += src.slice(i, open)
    const close = src.indexOf('*/', open + 2)
    if (close === -1) { comments.push(src.slice(open)); break }
    comments.push(src.slice(open, close + 2))
    i = close + 2
  }
  return { code, comments }
}

let hits = 0
for (const file of changed) {
  let src
  try { src = readFileSync(file, 'utf8') } catch { continue }
  const { code, comments } = splitComments(src)
  // A whole measurement, not the tail of a bigger one: "115px" is not a 5px
  // claim, and "57px" is not a 7px claim. That false-positive class swamped
  // the real drift on the first pass.
  const mentions = (text, n) => {
    let i = 0
    for (;;) {
      const at = text.indexOf(`${n}px`, i)
      if (at === -1) return false
      i = at + 1
      const before = at === 0 ? ' ' : text[at - 1]
      if (before >= '0' && before <= '9') continue
      if (before === '.' || before === '-') continue
      return true
    }
  }

  for (const c of comments) {
    for (const n of SUSPECT) {
      // quoted as a px measurement inside the prose
      if (!mentions(c, n)) continue
      // still present as a real value anywhere in this file's code?
      if (mentions(code, n)) continue
      const line = src.slice(0, src.indexOf(c)).split('\n').length
      const snippet = c.replace(/\s+/g, ' ').trim()
      const at = snippet.indexOf(`${n}px`)
      hits += 1
      console.log(`${file}:${line}  claims ${n}px, none left in file`)
      console.log(`    …${snippet.slice(Math.max(0, at - 70), at + 60)}…`)
    }
  }
}
console.log(`\n${hits} stale px claim(s)`)
