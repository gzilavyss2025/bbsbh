// The hover card's trigger store (src/lib/playerHoverStore.js). One thing here
// is new and easy to break: `detail`, a caller's own figures for the card to
// print in place of the season line. It rides with the pointed-at man, so two
// triggers for the same man (a plot face and a list photo) can ask for the
// same card, and a close must clear it, or the next plain name link would open
// a card carrying the last card's figures.
import assert from 'node:assert/strict'
import test from 'node:test'
import { getHoverSnapshot, hideHoverNow, scheduleHoverShow } from '../src/lib/playerHoverStore.js'

const RECT = { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }

test('an immediate show carries the caller detail with it', () => {
  const detail = { columns: ['Calls'], row: { label: 'Season', cells: [{ v: '7' }] }, strip: null }
  scheduleHoverShow(1, 'A Man', RECT, { immediate: true, detail })
  assert.equal(getHoverSnapshot().id, 1)
  assert.equal(getHoverSnapshot().detail, detail)
  hideHoverNow()
})

test('a plain show has no detail, and a close clears the last one', () => {
  scheduleHoverShow(1, 'A Man', RECT, { immediate: true, detail: { columns: [] } })
  hideHoverNow()
  assert.equal(getHoverSnapshot().id, null)
  assert.equal(getHoverSnapshot().detail, null)
  scheduleHoverShow(2, 'Another', RECT, { immediate: true })
  assert.equal(getHoverSnapshot().detail, null)
  hideHoverNow()
})
