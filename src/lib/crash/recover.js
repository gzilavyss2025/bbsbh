// Self-repair for an installed app that breaks on its own cached files. A phone can hold a
// service worker and chunk caches from an older deploy; when they disagree with the live site,
// a route can throw or fail to load and the page goes blank, and only clearing site data fixed
// it. So the app repairs itself: drop the CACHED CODE (Cache Storage and the service worker,
// never localStorage — reveal marks, stamps and preferences stay) and reload from the network.
//
// Once per session, automatically. A second failure soon after means the cache was not the
// problem, so the caller shows a reload card instead of looping. The flag clears a few seconds
// after a clean load, so the next deploy can repair itself too.

const FLAG = 'bbsbh:recovered'

// (storage) -> boolean. true the first time in a session (and marks it); false after that.
export function claimRecovery(storage) {
  try {
    if (storage.getItem(FLAG)) return false
    storage.setItem(FLAG, '1')
    return true
  } catch {
    return false // storage blocked: never auto-reload, because we could not stop a loop
  }
}

export function clearRecoveryFlag(storage) {
  try { storage.removeItem(FLAG) } catch { /* nothing to clear */ }
}

// Drops every Cache Storage entry and unregisters the service worker, then reloads.
export async function purgeAndReload() {
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch { /* no Cache Storage */ }
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  } catch { /* no service worker */ }
  window.location.reload()
}

// The automatic repair: purge and reload once a session. Returns whether it did.
export function recoverOnce(storage = sessionStorage, repair = purgeAndReload) {
  if (!claimRecovery(storage)) return false
  repair()
  return true
}
