// Innings pitched and outs, shared. The feed's "6.1" is whole innings plus the
// outs left over (6⅓), NOT a decimal: "104.2" + one out is "105.0", so sums and
// comparisons run in outs. Pure arithmetic on the argument, no game state.
import { num } from './number.js'

// "104.1" -> 313. Reads one digit after the dot; `.3` is 3 outs, blank is 0.
export function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}

// 313 -> "104.1".
export function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}
