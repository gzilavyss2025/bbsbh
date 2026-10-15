import { actionPhotoUrl } from '../../../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../../../lib/headshot/retry.js'

// The action photo behind the hero row (#1863, layout C). Decorative: the name is in the
// heading, so alt is empty. It is invisible until it loads, and removed on error, so a
// player with no photo (a 404) keeps the plain hero. Never a broken image, never a silhouette.
export function HeroActionPhoto({ personId, ready, onReady, onGone }) {
  const src = actionPhotoUrl(personId)
  if (!src) return null
  return (
    <img
      className={`pnext__action${ready ? ' is-ready' : ''}`}
      src={src}
      alt=""
      crossOrigin={HEADSHOT_CROSS_ORIGIN}
      decoding="async"
      onLoad={onReady}
      onError={onGone}
    />
  )
}
