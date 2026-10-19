import { readFileSync } from 'node:fs'
import { csvObjects } from '../../src/lib/csv/parse.js'
const rows = csvObjects(readFileSync('sv/lhh-lhp-si-hr-2026.csv', 'utf8').replace(/^﻿/, ''))
const HALF = 17/12/2, THIRD = 17/12/6
const ang = (x, y) => Math.atan2(x-125.42, 198.27-y)*180/Math.PI
const hits = rows.map(r => ({ d: r.game_date, pk: r.game_pk, ang: ang(+r.hc_x, +r.hc_y), px: +r.plate_x, zone: r.zone, who: r.player_name, pit: r.des }))
console.log('rows', rows.length, 'stands', [...new Set(rows.map(r=>r.stand))], 'throws', [...new Set(rows.map(r=>r.p_throws))], 'pt', [...new Set(rows.map(r=>r.pitch_type))], 'maxdate', rows.map(r=>r.game_date).sort().pop())
const oppo = hits.filter(h => h.ang < -15)
const inner = oppo.filter(h => h.px > THIRD && h.px <= HALF)
console.log('oppo', oppo.length, 'oppo+inner', inner.length)
console.log(inner.sort((a,b)=>b.d.localeCompare(a.d)).slice(0,5))
// zone vs plate_x agreement: LHH inner third = catcher-view right column = zones 3,6,9
const inZone = hits.filter(h => ['1','2','3','4','5','6','7','8','9'].includes(h.zone))
const agree = inZone.filter(h => (['3','6','9'].includes(h.zone)) === (h.px > THIRD)).length
console.log('in-zone', inZone.length, 'zone-col3 vs px>third agree', agree)
console.log('angle spread of all HR', Math.min(...hits.map(h=>h.ang)).toFixed(0), Math.max(...hits.map(h=>h.ang)).toFixed(0))
