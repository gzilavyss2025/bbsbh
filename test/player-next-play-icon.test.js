// Slice 20d (#2073): the Form trend Play button carries the canvas play and pause icon.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', 'player', 'next')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('the icon is the canvas triangle and two bars, in the button ink, at 16px', () => {
  const s = read('parts/PlayPauseIcon.jsx')
  assert.match(s, /const PLAY = 'M5 3L16 10L5 17Z'/)
  assert.match(s, /const PAUSE = 'M5 3H8V17H5Z M12 3H15V17H12Z'/)
  assert.match(s, /<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">/)
  assert.match(s, /<path d=\{playing \? PAUSE : PLAY\} fill="currentColor" \/>/)
  assert.doesNotMatch(s, /#[0-9a-fA-F]{3,8}\b/, 'no raw hex')
})

test('the batter and pitcher Play buttons pass the icon and keep their label', () => {
  for (const file of ['modules/form/FormModule.jsx', 'modules/pform/index.jsx']) {
    const s = read(file)
    assert.match(s, /import \{ PlayPauseIcon \} from '\.\.\/\.\.\/parts\/PlayPauseIcon\.jsx'/, file)
    assert.match(s, /<Button size="control" icon=\{<PlayPauseIcon playing=\{running\} \/>\} onClick=/, file)
    assert.match(s, /\{running \? 'Pause' : 'Play the season'\}/, file)
    assert.match(s, /\{!motionIsReduced\(\) && \(\s*<Button size="control" icon=/, `${file}: the reduced-motion guard stays`)
  }
})
