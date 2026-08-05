#!/usr/bin/env node
// Guards the box-score skeleton's rolling-ball sprite strip
// (src/components/game/BoxScoreSkeleton.jsx + the .skel__ballFrames rule in
// src/styles/*.css) against the two files silently drifting apart. The CSS
// hardcodes BALL_FRAME_COUNT * BALL_SPIN_LOOPS in three places (the frame
// strip's width, the steps() count, and the skel-ball-spin keyframe's
// translateX fraction) because CSS steps() needs a literal integer, not a
// var() — a change to either JS constant without updating all three CSS
// values breaks the animation (wrong frame under the circular window, or the
// strip running past its precomputed frames into blank space) with nothing
// else to catch it.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const jsPath = join(ROOT, 'src/components/game/BoxScoreSkeleton.jsx')
// The rules live in one of the src/styles/*.css partials (today
// 22-box-score-tables.css). Read them ALL and concatenate rather than naming
// the partial: which one holds a given rule is an implementation detail of how
// index.css was split, and pinning it here would make an ordinary re-cut of the
// stylesheet look like a drift failure.
const stylesDir = join(ROOT, 'src/styles')

const errors = []

// Both targets are addressed by hard-coded path, so either one moving would
// otherwise kill this script with an ENOENT stack trace. Report it as a guard
// failure instead — the check still fails (which is right; it has stopped
// checking), but it says which file to repoint and why.
function readTarget(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    errors.push(`${path.slice(path.indexOf('src')).replace(/\\/g, '/')} — named in this guard but no longer exists`)
    return null
  }
}

const js = readTarget(jsPath)

let css = null
try {
  const sheets = readdirSync(stylesDir).filter((f) => f.endsWith('.css')).sort()
  if (!sheets.length) throw new Error('empty')
  css = sheets.map((f) => readFileSync(join(stylesDir, f), 'utf8')).join('\n')
} catch {
  errors.push('src/styles/*.css — named in this guard but no stylesheet partials were found')
}

function extract(source, pattern, label) {
  const m = source.match(pattern)
  if (!m) {
    errors.push(`Couldn't find ${label} — has the source moved or been renamed?`)
    return null
  }
  return Number(m[1])
}

// An explicit null, never `js && extract(...)`. Both falsy cases matter and a
// bare && gets each one wrong: a MISSING file (js === null) would short-circuit
// to null — fine — but an EMPTY one reads as '', which short-circuits to '' and
// then satisfies the `!= null` gate below, so the guard would run its CSS
// arithmetic on a missing constant and blame the stylesheet for a JS problem.
// Written this way, a missing file skips extraction (readTarget already filed
// the error) and an empty one still goes through extract(), which reports the
// constant it could not find.
const frameCount = js == null ? null : extract(js, /const BALL_FRAME_COUNT = (\d+)/, 'BALL_FRAME_COUNT in BoxScoreSkeleton.jsx')
const spinLoops = js == null ? null : extract(js, /const BALL_SPIN_LOOPS = (\d+)/, 'BALL_SPIN_LOOPS in BoxScoreSkeleton.jsx')

if (css && frameCount != null && spinLoops != null) {
  const totalSteps = frameCount * spinLoops

  const framesBlock = css.match(/\.skel__ballFrames\s*\{[^}]*\}/)?.[0]
  if (!framesBlock) {
    errors.push("Couldn't find the .skel__ballFrames rule in src/styles/*.css")
  } else {
    const width = extract(framesBlock, /width:\s*(\d+)%/, '.skel__ballFrames width')
    if (width != null && width !== totalSteps * 100) {
      errors.push(
        `.skel__ballFrames width is ${width}% but BALL_FRAME_COUNT (${frameCount}) * BALL_SPIN_LOOPS (${spinLoops}) * 100 = ${totalSteps * 100}%`,
      )
    }
    const steps = extract(framesBlock, /steps\((\d+)\)/, '.skel__ballFrames steps() count')
    if (steps != null && steps !== totalSteps - 1) {
      errors.push(
        `.skel__ballFrames uses steps(${steps}) but should be steps(${totalSteps - 1}) (BALL_FRAME_COUNT * BALL_SPIN_LOOPS - 1)`,
      )
    }
  }

  const spinBlock = css.match(/@keyframes skel-ball-spin\s*\{[\s\S]*?\n\}/)?.[0]
  if (!spinBlock) {
    errors.push("Couldn't find the @keyframes skel-ball-spin rule in src/styles/*.css")
  } else {
    const calcMatch = spinBlock.match(/calc\(-(\d+)\s*\/\s*(\d+)\s*\*\s*100%\)/)
    if (!calcMatch) {
      errors.push("Couldn't find skel-ball-spin's translateX calc(-N / D * 100%) expression")
    } else {
      const [numerator, denominator] = [Number(calcMatch[1]), Number(calcMatch[2])]
      if (numerator !== totalSteps - 1 || denominator !== totalSteps) {
        errors.push(
          `skel-ball-spin's translateX is calc(-${numerator} / ${denominator} * 100%) but should be ` +
            `calc(-${totalSteps - 1} / ${totalSteps} * 100%)`,
        )
      }
    }
  }
}

if (errors.length) {
  console.error(
    '\n✗ Box-score skeleton ball-frame guard failed — BoxScoreSkeleton.jsx and\n' +
      "  the .skel__ballFrames/skel-ball-spin rules in src/styles/*.css have drifted\n" +
      '  apart:\n',
  )
  for (const error of errors) console.error(`  ${error}`)
  console.error(
    '\n  Update BALL_FRAME_COUNT/BALL_SPIN_LOOPS (BoxScoreSkeleton.jsx) and the\n' +
      '  three CSS values together — see that file\'s comment above BALL_FRAME_COUNT.\n',
  )
  process.exit(1)
}

console.log('✓ BoxScoreSkeleton.jsx and the .skel__ballFrames/skel-ball-spin CSS rules agree.')
