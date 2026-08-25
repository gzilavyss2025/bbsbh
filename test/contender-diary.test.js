import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  RESEARCH_DIARY,
  VERDICTS,
  HOW_TO_READ,
  TRAPS,
} from '../src/lib/research/contenderDiary/index.js'

// The sibling of test/research-diary.test.js, for the OTHER diary. That file
// has guarded the prospect diary's shape since it was written; this one was
// missing, so the Contender Diary — same authored-data shape, same page
// renderer, same two house rules — had none of the same protection. An entry
// appended at the bottom, an entry shipped with an empty caveats list, or a
// table row that does not match its header would all have rendered wrong on
// /admin/contenders with nothing complaining.
//
// Deliberately a near-copy of the prospect diary's test rather than a shared
// helper, for the same reason the two diary modules are not shared (see
// docs/agents/contender-diary.md): the two vocabularies already differ, and a
// shared assertion helper would quietly force one diary's rules onto the
// other the first time they diverge again.

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
  const dates = RESEARCH_DIARY.map((entry) => entry.date)
  const sorted = [...dates].sort().reverse()
  assert.deepEqual(dates, sorted)
})

test('no entry claims to be without limits', () => {
  for (const entry of RESEARCH_DIARY) {
    assert.ok(entry.caveats?.length, `${entry.id}: caveats must not be empty`)
    assert.ok(Array.isArray(entry.open), `${entry.id}: open must be an array`)
  }
})

test('every entry that reports a finding shows its working', () => {
  // The voice rule (docs/agents/contender-diary.md) moves the formal numbers
  // into `technical` rather than deleting them, and check-diary-voice.mjs
  // enforces the FIRST half of that — no statistics vocabulary in the prose.
  // Nothing enforced the second half, so an entry could pass the voice guard
  // by being plain-spoken and carrying no numbers anywhere. `framework` is
  // exempt because it measures nothing by design.
  for (const entry of RESEARCH_DIARY) {
    if (entry.verdict === 'framework') continue
    assert.ok(
      entry.technical?.length,
      `${entry.id}: a finding entry must carry its formal numbers in \`technical\``,
    )
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

test('the traps heading can still count the traps it is standing over', () => {
  // ContenderDiaryPage.jsx spells the count as a word from its own COUNT_WORDS
  // list; a count that runs off the end falls back to a numeral, which is not
  // this page's voice. Read the ceiling off the page instead of hard-coding a
  // number here, so widening the page's list is enough to widen this test.
  const page = readFileSync(
    new URL('../src/screens/contenders/ContenderDiaryPage.jsx', import.meta.url),
    'utf8',
  )
  const words = page.match(/const COUNT_WORDS = \[([\s\S]*?)\]/)
  assert.ok(words, 'COUNT_WORDS not found in ContenderDiaryPage.jsx')
  const ceiling = words[1].split(',').filter((word) => word.trim()).length - 1
  assert.ok(
    TRAPS.length <= ceiling,
    `TRAPS is ${TRAPS.length}; widen COUNT_WORDS in ContenderDiaryPage.jsx (holds up to ${ceiling}) before adding more`,
  )
})
