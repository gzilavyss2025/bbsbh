import { localStore } from '../../../../lib/account/localStore.js'

// The zone map's dismiss (#2568, decided 2026-10-26): closed for this game, through a reload; the
// next game shows it again. One flag per game under bbsbh:zonemap:{gamePk}: a flag, never a score.
const store = (gamePk) => localStore(`bbsbh:zonemap:${gamePk}`, (v) => v === '1', String)

export const zoneMapDismissed = (gamePk) => store(gamePk).read()
export const dismissZoneMap = (gamePk) => store(gamePk).write('1')
