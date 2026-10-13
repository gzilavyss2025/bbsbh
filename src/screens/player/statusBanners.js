// The player page's status banners (All-Star, rehab, injured list, last played), as plain
// text in the order the page shows them. Pure; the live hub and the new page both draw it.
// `startingToday`: he is announced as TODAY's probable starter for the club that has him on
// rehab or the IL. MLB posts that days before the activation transaction these banners key
// on, so the banner would be stale on its face. See api/player/core.js.
export function statusBannersView(core) {
  const out = []
  if (core.isAllStar) out.push({ key: 'allstar', text: `${core.currentYear} All-Star` })
  if (core.onRehab && !core.startingToday) {
    out.push({ key: 'rehab', text: `Rehab Assignment${core.rehab?.name ? ` · ${core.rehab.name}` : ''}` })
  }
  if (core.onIL && !core.startingToday) {
    out.push({ key: 'il', text: `Injured List${core.il?.days ? ` · ${core.il.days}-Day` : ''}` })
  }
  if (core.lastPlayedYear) out.push({ key: 'lastplayed', text: `Last played in ${core.lastPlayedYear}` })
  return out
}
