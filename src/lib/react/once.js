// Wrap a dynamic import so it fires at most once; a failed load is swallowed
// (lazy() owns real error handling when the route actually opens).
export function once(loader) {
  let fired = false
  return () => {
    if (fired) return
    fired = true
    loader().catch(() => {})
  }
}
