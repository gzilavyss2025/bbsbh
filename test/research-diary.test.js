import test from 'node:test'
import assert from 'node:assert/strict'
import { RESEARCH_DIARY, VERDICTS, HOW_TO_READ, TRAPS } from '../src/lib/research/diary/index.js'

// The diary is authored data, so what is worth testing is not a computation —
// it is the shape the page renders blind, and the two house rules that make the
// page worth having at all. Both of those rules are the kind that decay
// silently: an entry appended in the wrong place, or an entry shipped with an
// empty caveats list because the finding felt clean that day.

test('every entry carries the fields the page renders', () => {
  assert.ok(RESEARCH_DIARY.length > 0, 'the diary must not be empty')
  for (const entry of RESEARCH_DIARY) {
    assert.match(entry.id, /^[a-z0-9-]+$/, `${entry.id}: id must be a slug`)
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `${entry.id}: date must be ISO`)
    for (const field of ['title', 'question', 'headline', 'source', 'doc']) {
      assert.ok(entry[field]?.length, `${entry.id}: missing ${field}`)
    }
    assert.ok(VERDICTS[entry.verdict], `${entry.id}: unknown verdict ${entry.verdict}`)
    assert.ok(entry.sections.length, `${entry.id}: needs at least one section`)
  }
})

test('entry ids are unique — they are the page anchors', () => {
  const ids = RESEARCH_DIARY.map((entry) => entry.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('newest first, and it stays that way', () => {
  // The append-at-the-top rule. An entry added to the bottom out of habit would
  // render as the oldest finding on the page and nothing else would complain.
  const dates = RESEARCH_DIARY.map((entry) => entry.date)
  const sorted = [...dates].sort().reverse()
  assert.deepEqual(dates, sorted)
})

test('no entry claims to be without limits', () => {
  // The house rule with the most value and the least enforcement anywhere else:
  // a finding with no stated caveat has not been examined hard enough.
  for (const entry of RESEARCH_DIARY) {
    assert.ok(entry.caveats?.length, `${entry.id}: caveats must not be empty`)
    assert.ok(Array.isArray(entry.open), `${entry.id}: open must be an array`)
  }
})

test('sections render cleanly — tables are rectangular, keys are unique', () => {
  for (const entry of RESEARCH_DIARY) {
    const sectionIds = entry.sections.map((section) => section.id)
    assert.equal(
      new Set(sectionIds).size,
      sectionIds.length,
      `${entry.id}: duplicate section id`,
    )
    for (const section of entry.sections) {
      assert.ok(section.heading?.length, `${entry.id}/${section.id}: needs a heading`)
      const table = section.table
      if (!table) continue
      assert.ok(table.caption?.length, `${entry.id}/${section.id}: table needs a caption`)
      assert.ok(table.columns.length >= 2, `${entry.id}/${section.id}: table needs columns`)
      for (const row of table.rows) {
        assert.equal(
          row.length,
          table.columns.length,
          `${entry.id}/${section.id}: row "${row[0]}" does not match the header`,
        )
      }
      // The renderer keys rows on row[0], so a repeat would drop a row silently.
      const heads = table.rows.map((row) => row[0])
      assert.equal(
        new Set(heads).size,
        heads.length,
        `${entry.id}/${section.id}: duplicate row label`,
      )
    }
  }
})

test('the standing front matter is present', () => {
  assert.ok(HOW_TO_READ.length >= 1)
  assert.ok(TRAPS.length >= 1)
  const ids = TRAPS.map((trap) => trap.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const trap of TRAPS) {
    assert.ok(trap.title?.length && trap.body?.length, `${trap.id}: incomplete trap`)
  }
})

test('the traps heading counts the traps it is standing over', () => {
  // The heading used to say "Five things that will fool you" as a literal, and
  // it went stale the first time the list grew to eight. The page now derives
  // the word, and this pins the word list wide enough to keep deriving it —
  // a count that runs off the end of COUNT_WORDS silently falls back to a
  // numeral, which is not this page's voice.
  assert.ok(TRAPS.length >= 1, 'there must be traps to count')
  assert.ok(
    TRAPS.length <= 12,
    `TRAPS is ${TRAPS.length}; widen COUNT_WORDS in ResearchDiaryPage.jsx before adding more`,
  )
})
