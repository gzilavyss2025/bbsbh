// How each player joined his organization, and his draft pick, for the trade
// card (/trade). One file per organization, built nightly by
// scripts/trade/gen-trade-pedigree.mjs. A missing file is a card with no pedigree
// line, never a failed page.
import { staticJsonBy } from '../staticJson.js'

const fetchOrg = staticJsonBy((orgId) => `/data/trade-pedigree/${orgId}.json`, { fallback: null })

export async function fetchTradePedigree(orgId) {
  const file = await fetchOrg(orgId)
  return file?.players ?? {}
}
