// How badly is `mls` wrong, and can the bad cells be told from the good ones?
//
// The test is a provable one. A man whose FIRST day on a major-league active
// roster falls after the season's service line cannot reach 172 days, so his
// service the next spring must read 0 years. Any cell on such a man that reads
// one year or more is wrong, whatever else is true.
import { writeFile } from 'node:fs/promises'
import { j, local, pct, fmt } from './lib.mjs'

const all = await j(local('panel'))
const say = (s) => process.stdout.write(s + '\n')

// Men who provably cannot have banked a year: joined the active roster after
// the line, in a season the wire covers, with a service cell the next spring.
const provable = all.filter(
  (r) => !r.excludedSeason && r.addRelDay != null && r.addRelDay >= 1 && r.mlsNextRaw != null,
)
const bare = provable.filter((r) => r.mlsNextIsBareInteger)
const frac = provable.filter((r) => !r.mlsNextIsBareInteger)
const wrongBare = bare.filter((r) => r.mlsNextYears >= 1)
const wrongFrac = frac.filter((r) => r.mlsNextYears >= 1)

say('Men who provably banked NO service year (joined the roster after the line):')
say(`  total with a next-spring cell      ${provable.length}`)
say(`  cell is a bare integer             ${bare.length}   of these, WRONG (reads >= 1 year): ${wrongBare.length}  ${pct(wrongBare.length / bare.length)}`)
say(`  cell carries a day count           ${frac.length}   of these, WRONG (reads >= 1 year): ${wrongFrac.length}  ${pct(wrongFrac.length / frac.length)}`)
say('')
say('So a day-count cell is right ' + pct(1 - wrongFrac.length / frac.length) + ' of the time on this test, and a bare')
say('integer is wrong ' + pct(wrongBare.length / bare.length) + ' of the time. The two are different populations.')
say('')

// The other half: men who provably COULD bank a year — on the roster from the
// league opener, never removed. Their correct cell is exactly 1.000, which the
// source writes as a bare "1". So the good and the bad cells share a spelling.
const couldBank = all.filter(
  (r) => !r.excludedSeason && r.addRelDay != null && r.addRelDay <= 0 && r.mlsNextRaw != null,
)
const cbBare = couldBank.filter((r) => r.mlsNextIsBareInteger)
say('Men who COULD have banked a year (joined on or before the line):')
say(`  total with a next-spring cell      ${couldBank.length}`)
say(`  cell is a bare integer             ${cbBare.length}  reading exactly "1": ${cbBare.filter((r) => r.mlsNextRaw === '1').length}`)
say('')
say('THE BIND. A man who banks exactly one year is written "1". A man whose')
say('service was rounded to a season count is also written "1". The cell cannot')
say('tell them apart, so `mls` can neither confirm the line nor be used to')
say('measure who beat it. Excluding the bare integers removes the confirmations')
say('along with the errors.')

const out = {
  provable: provable.length,
  bareInteger: bare.length,
  bareIntegerWrong: wrongBare.length,
  dayCount: frac.length,
  dayCountWrong: wrongFrac.length,
  couldBank: couldBank.length,
  couldBankBare: cbBare.length,
  examples: wrongBare.slice(0, 8).map((r) => ({
    name: r.name,
    debutSeason: r.debutSeason,
    line: r.cutoff,
    rosterAdd: r.rosterAddDate,
    daysPastLine: r.addRelDay,
    cellSaid: r.mlsNextRaw,
    couldNotExceedDays: r.addRelDay != null ? 172 - r.addRelDay : null,
  })),
}
say('')
say('examples of a provably wrong cell:')
for (const e of out.examples)
  say(`  ${e.name} ${e.debutSeason}: line ${e.line}, joined ${e.rosterAdd} (+${e.daysPastLine}), next spring reads "${e.cellSaid}"`)
await writeFile(local('mls-defect'), JSON.stringify(out, null, 1))
