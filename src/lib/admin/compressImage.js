// Shrink an image IN THE BROWSER, before it is ever uploaded.
//
// WHY HERE AND NOT NIGHTLY. The repo already has an image-compression step —
// scripts/compress-logos.mjs, run by the nightly data cron. It was the obvious
// place to hang ballpark uploads off, and it is the wrong one, for a reason
// worth writing down rather than rediscovering. That script works on FILES IN
// THE REPO: it walks public/team-logos, rewrites them in place, and the cron
// commits the result. An image uploaded from the live site is in a blob store,
// not the repo, so the nightly job would never see it — and if it were taught
// to, the commit it made would trigger a Vercel deploy, which is precisely what
// this whole feature exists to avoid.
//
// The deeper problem is that deferred compression is the wrong SHAPE for this.
// The owner uploads a photo and looks at the page. "It will be smaller
// tomorrow" is not a property anyone can verify at the moment they care, and a
// 6 MB phone photograph served for a day to every visitor is a real cost paid
// by the wrong people. Doing it here makes the size deterministic and visible:
// what you upload is what ships, immediately, and the endpoint's byte cap
// becomes a limit you cannot accidentally cross rather than one you discover.
//
// Nothing here is score-bearing — it is a canvas and an image the admin chose.

// Decode a File into something drawable, preferring createImageBitmap (fast,
// off the main thread where supported) and falling back to an <img> and an
// object URL for browsers that lack it or refuse a given encoding. Either way
// the object URL is revoked — a leaked one pins the whole decoded bitmap in
// memory for the life of the document, which on a phone is exactly the device
// that cannot afford it.
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fall through — some browsers reject certain encodings here but still
      // render them through an <img>.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('could not read that image'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawScaled(source, scale) {
  const width = Math.max(1, Math.round((source.width || 1) * scale))
  const height = Math.max(1, Math.round((source.height || 1) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Nearest-neighbour on a downscale of a photograph looks like a mistake;
  // 'high' is the browser's own multi-step filter and costs nothing here.
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('could not re-encode that image'))),
      type,
      quality,
    )
  })
}

// The quality ladder for a photograph. It steps DOWN rather than binary
// searching because the goal is not the largest file that fits — it is a
// predictable, good-looking result, and 0.82 is already visually indistinct
// from the original at this size. Most photos never leave the first rung.
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.5]

// Compress `file` to something the upload endpoint will accept.
//
//   maxWidth  — longest edge, in CSS pixels. The card renders the photo in a
//               16:9 box that is at most ~1100px wide on a desktop, so 1600
//               covers a 2x phone screen with room to spare and anything above
//               it is bytes nobody sees.
//   maxBytes  — the hard ceiling, matching the endpoint's cap for this kind.
//   transparent — keep the alpha channel. A wordmark is lettering that must sit
//               on the card's paper, so it stays PNG and is only ever RESIZED,
//               never re-encoded as JPEG; flattening it onto white would put a
//               visible box around the name. A photograph has no alpha to lose
//               and becomes JPEG, which is what makes it small.
//
// Throws with a human-readable message on a file the browser cannot decode.
// Returns { blob, contentType, width, height } — the caller uploads `blob`.
export async function compressImage(file, { maxWidth = 1600, maxBytes = 1_500_000, transparent = false } = {}) {
  const source = await decode(file)
  const type = transparent ? 'image/png' : 'image/jpeg'
  let scale = Math.min(1, maxWidth / (source.width || maxWidth))

  // Up to four passes. A PNG wordmark has no quality knob, so its only lever is
  // resolution and it halves each time; a JPEG walks the quality ladder at full
  // size first and only then gives up pixels. Either way this terminates.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = drawScaled(source, scale)
    const qualities = transparent ? [undefined] : JPEG_QUALITIES
    for (const quality of qualities) {
      const blob = await encode(canvas, type, quality)
      if (blob.size <= maxBytes) {
        source.close?.()
        return { blob, contentType: type, width: canvas.width, height: canvas.height }
      }
    }
    scale *= 0.7
  }

  source.close?.()
  throw new Error('that image is too detailed to get under the size limit — try a smaller one')
}
