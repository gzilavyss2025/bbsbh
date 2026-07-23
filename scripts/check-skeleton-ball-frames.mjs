#!/usr/bin/env node
// Guards the box-score skeleton's rolling-ball sprite strip
// (src/components/BoxScoreSkeleton.jsx + the .skel__ballFrames rule in
// src/index.css) against the two files silently drifting apart. The CSS
// hardcodes BALL_FRAME_COUNT * BALL_SPIN_LOOPS in three places (the frame
// strip's width, the steps() count, and the skel-ball-spin keyframe's
// translateX fraction) because CSS steps() needs a literal integer, not a
// var() — a change to either JS constant without updating all three CSS
// values breaks the animation (wrong frame under the circular window, or the
// strip running past its precomputed frames into blank space) with nothing
// else to catch it.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const jsPath = join(ROOT, 'src/components/BoxScoreSkeleton.jsx')
const cssPath = join(ROOT, 'src/index.css')
const js = readFileSync(jsPath, 'utf8')
const css = readFileSync(cssPath, 'utf8')

const errors = []

function extract(source, pattern, label) {
  const m = source.match(pattern)
  if (!m) {
    errors.push(`Couldn't find ${label} — has the source moved or been renamed?`)
    return null
  }
  return Number(m[1])
}

const frameCount = extract(js, /const BALL_FRAME_COUNT = (\d+)/, 'BALL_FRAME_COUNT in BoxScoreSkeleton.jsx')
const spinLoops = extract(js, /const BALL_SPIN_LOOPS = (\d+)/, 'BALL_SPIN_LOOPS in BoxScoreSkeleton.jsx')

if (frameCount != null && spinLoops != null) {
  const totalSteps = frameCount * spinLoops

  const framesBlock = css.match(/\.skel__ballFrames\s*\{[^}]*\}/)?.[0]
  if (!framesBlock) {
    errors.push("Couldn't find the .skel__ballFrames rule in src/index.css")
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
    errors.push("Couldn't find the @keyframes skel-ball-spin rule in src/index.css")
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
      "  the .skel__ballFrames/skel-ball-spin rules in src/index.css have drifted\n" +
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
