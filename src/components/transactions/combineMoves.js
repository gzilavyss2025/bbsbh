// One club's run of same-kind, one-player moves on one day, read as ONE card.
// Lives beside MoveRow, its one caller: src/api/transactions/ is at its file cap.
//
// A club calling up five minor leaguers files five rows, and the wire drew five
// near-identical lines ("Selected the contract of LHP Spencer Giesting from Reno
// Aces." x5). This folds a day's one-player stories that share a club and an
// action into one story whose cutline names them all, one clause per
// destination or source club:
//
//   Selected the contracts of LHP Spencer Giesting and RHP Ashton Izzi from Reno
//   Aces; selected the contracts of CF Druw Jones and 2B Cristofer Torin from
//   Amarillo Sod Poodles.
//
// The clauses join on "; " because MoveRow's split view breaks a cutline there,
// so each clause gets its players' notes under "More". It runs AFTER the
// grouping pass (team.js), on finished stories, and only ever merges stories
// that each carry one player, so no grouping rule there is bent. The merged
// story sits where its first move was. Pure; tested in
// test/transactions-batch.test.js.

// The parts of a one-player story's cutline: "<verb><POS> <Name><tail>".
// Null when the story is not that shape, so it is left alone.
function partsOf(story) {
  if (story?.rail?.length !== 1) return null
  const pos = story.rail[0]?.pos
  const [head, player, ...tail] = story.cutline ?? []
  if (!pos || !player?.playerId || !head?.text?.endsWith(`${pos} `)) return null
  const verb = head.text.slice(0, -(pos.length + 1))
  if (!verb.trim()) return null
  return { verb, pos, player, tail }
}

const tailKey = (tail) => JSON.stringify(tail.map((s) => [s.text, s.teamId ?? null]))

function withoutPeriod(tail) {
  const out = tail.map((s) => ({ ...s }))
  const last = out[out.length - 1]
  if (last && !last.teamId && !last.playerId) {
    last.text = last.text.replace(/\.\s*$/, '')
    if (!last.text) out.pop()
  }
  return out
}

function clause(verb, members, first) {
  const plural = members.length > 1 ? verb.replace(' the contract of ', ' the contracts of ') : verb
  const lead = first ? plural : plural.charAt(0).toLowerCase() + plural.slice(1) // caps-js-exempt: a clause after "; " continues the sentence
  const segs = [{ text: `${lead}${members[0].pos} ` }, members[0].player]
  members.slice(1).forEach((m, i) => {
    segs.push({ text: `${i === members.length - 2 ? ' and ' : ', '}${m.pos} ` }, m.player)
  })
  return [...segs, ...withoutPeriod(members[0].tail)]
}

function merge(group) {
  const byTail = new Map()
  for (const m of group) {
    const k = tailKey(m.tail)
    if (!byTail.has(k)) byTail.set(k, [])
    byTail.get(k).push(m)
  }
  const clauses = [...byTail.values()].map((members, i) => clause(group[0].verb, members, i === 0))
  const cutline = clauses.flatMap((c, i) => (i ? [{ text: '; ' }, ...c] : c))
  cutline.push({ text: '.' })
  const first = group[0].story
  return {
    ...first,
    id: `${first.id}+${group.length - 1}`,
    codes: [...new Set(group.flatMap((m) => m.story.codes ?? []))],
    moves: group.flatMap((m) => m.story.moves ?? []),
    rail: group.flatMap((m) => m.story.rail),
    cutline,
  }
}

// RULE 5 PROTECTION. Each November, clubs add players to the 40-man roster so
// another club cannot take them in December's Rule 5 draft; the wire files
// each as "Selected the contract of…", which read as a call-up (the Brewers'
// six, Nov. 17, 2026). A November selection is that add, so its lead says
// so, one sentence naming them all, under a "Rule 5 protection" label:
//
//   Added six to the 40-man roster ahead of the Rule 5 draft: C Matthew Wood,
//   2B Dylan O'Rae, SS Jett Williams, 3B Luke Adams, RHP Cameron Wagoner and
//   LHP Tate Kuehner.
//
// The players' notes still read as selections (templates.js matches this lead).
const SELECTED = /^selected the contract of $/i
const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const isProtectionDay = (date) => /^\d{4}-11-/.test(date ?? '')

function protection(group) {
  const n = group.length
  const names = []
  group.forEach((m, i) => {
    if (i) names.push({ text: i === n - 1 ? ' and ' : ', ' })
    names.push({ text: `${m.pos} ` }, m.player)
  })
  const cutline = n === 1
    ? [{ text: 'Added ' }, ...names, { text: ' to the 40-man roster ahead of the Rule 5 draft.' }]
    : [{ text: `Added ${COUNT[n] ?? n} to the 40-man roster ahead of the Rule 5 draft: ` }, ...names, { text: '.' }]
  const first = group[0].story
  return {
    ...first,
    id: n > 1 ? `${first.id}+${n - 1}` : first.id,
    codes: [...new Set(group.flatMap((m) => m.story.codes ?? []))],
    moves: group.flatMap((m) => m.story.moves ?? []),
    rail: group.flatMap((m) => m.story.rail),
    cutline,
    typeLabel: 'Rule 5 protection',
  }
}

// One day's stories in, the same day's stories out, with each foldable run
// merged into one story at the position of its first member. `date` is the
// day's: a November selection reads as Rule 5 protection (above).
export function combineBatches(stories, date = null) {
  const groups = new Map()
  const keyOf = new Map()
  for (const story of stories ?? []) {
    const parts = partsOf(story)
    if (!parts) continue
    const key = `${story.teamId ?? ''}|${story.type ?? ''}|${parts.verb}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...parts, story })
    keyOf.set(story, key)
  }
  const out = []
  const done = new Set()
  for (const story of stories ?? []) {
    const key = keyOf.get(story)
    const group = key && groups.get(key)
    // A club's November selections, even one alone, read as its protection.
    if (group && isProtectionDay(date) && SELECTED.test(group[0].verb)) {
      if (done.has(key)) continue
      done.add(key)
      out.push(protection(group))
      continue
    }
    if (!group || group.length < 2) {
      out.push(story)
      continue
    }
    if (done.has(key)) continue
    done.add(key)
    out.push(merge(group))
  }
  return out
}
