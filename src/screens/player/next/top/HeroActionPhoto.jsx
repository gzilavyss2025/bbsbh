import { actionPhotoUrl } from '../../../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../../../lib/headshot/retry.js'

// The action photo at the hero row's right end (#1863). Decorative: the name is in the heading,
// so alt is empty. It is invisible until it loads, and removed on error, so a player with no
// photo (a 404) keeps the plain hero. Never a broken image, never a silhouette.
// Since 2026-10-30 (Gary) it is a crisp slanted slab edged with the club's three-band stripe,
// the home slate's champion hero's look, not a faded wash. `stripe` is [outer, inner] or null.
export function HeroActionPhoto({ personId, ready, onReady, onGone, stripe = null }) {
  const src = actionPhotoUrl(personId)
  if (!src) return null
  return (
    <span className={`pnext__actionslab${ready ? ' is-ready' : ''}`} aria-hidden="true">
      <img
        className="pnext__action"
        src={src}
        alt=""
        crossOrigin={HEADSHOT_CROSS_ORIGIN}
        decoding="async"
        fetchPriority="low"
        onLoad={onReady}
        onError={onGone}
      />
      {stripe && <span className="pnext__stripe" style={{ '--stripe-out': stripe[0], '--stripe-in': stripe[1] }} />}
    </span>
  )
}
