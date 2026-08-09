// High-res photos for a single game, from the same content-package endpoint
// highlights.js uses for video (`/api/v1/game/{gamePk}/content`). MLB serves
// every editorial photo through img.mlbstatic.com with Cloudinary-style resize
// instructions baked into the URL path (`.../upload/w_1920,h_1080,.../mlb/{id}.jpg`);
// stripping everything between `upload/` and the trailing `mlb/{id}` segment
// returns the original photographer upload (verified live: full-res originals
// run 6,000-8,000+ px wide, CORS-open, no auth). Thumbnails for the grid use
// the same trick in reverse — a bare `w_{n}` param inserted back in (verified
// live; MLB's own named transforms like `t_w2208` are NOT freely
// parameterizable, e.g. `t_w480` 400s).
//
// Deliberately NOT gated by the spoiler rule (SEE root CLAUDE.md) — a recap or
// celebration photo narrates the outcome just by looking at it, same as a
// highlight clip's title, but there is no reveal-only wrapper here. This is a
// standalone, unsealed personal tool (route.js's '/photos'), not part of the
// scored-game flow, and its page carries its own disclaimer. `headline` below
// is score-revealing for the same reason and rides the same exception — its
// only other consumer, GamePhotosStrip, renders inside the box score's seal.
//
// EVERY image here is a video THUMBNAIL. The `editorial` block (recap/wrap
// articles, which is where photographer galleries used to live) came back
// empty on every game checked across 88 games / 2,522 assets in Jul-Aug 2026,
// so the whole gallery comes from `highlights.highlights.items[].image`. That
// makes "is this a real photo" a question about which thumbnail MLB's editors
// attached, and it sorts into exactly three kinds:
//
//   photographer — a wire/staff still (Getty, AP, or an MLB Photos/Greenfly
//                  asset). Shot on a camera, so it is 3:2 and huge.
//   broadcast    — a frame grabbed off the TV feed. Always exactly 1280x720.
//   graphic      — a rendered card: Statcast "darkroom" visualizations
//                  (lineups, bullpen availability, bat tracking) and the
//                  designed GAME HIGHLIGHTS recap art. Always 16:9, and 1920+
//                  wide when it isn't tagged as one.
//
// The decisive signal is the ORIGINAL asset's aspect ratio, which Cloudinary
// will report without serving the file (`fl_getinfo`, ~130 bytes, CORS `*`,
// cached 3h). Cameras shoot 3:2; video is 16:9; the two never collide. Checked
// against 225 independently-labelled assets: every known photographer still
// was non-16:9, and every known broadcast frame and graphic was exactly 16:9.
//
// `image.title` — the original asset filename — is a free corroborating signal
// that needs no request, and it is checked first so a name-identified still
// costs nothing. It is NOT sufficient alone: MLB's CMS renames a large share
// of stills to "<headline> - thumbnail", the same shape it gives auto frame
// grabs, which is why the aspect check has to backstop it.
//
// Taxonomy keywords describe the VIDEO, not the image (a clip tagged
// `data-visualization` can still carry a broadcast still as its thumbnail), so
// they only ever break a tie between two 16:9 assets — never override a shape.
import { getJson } from './statsapi.js'

const CDN_PREFIX = 'https://img.mlbstatic.com/mlb-images/image/upload/'
// Matches any mlbstatic upload URL, capturing the trailing `mlb/{id}[.ext]`
// segment that survives every resize transform — that segment is the stable
// photo identity Cloudinary uses to key the original file.
const UPLOAD_RE = /^https:\/\/img\.mlbstatic\.com\/mlb-images\/image\/upload\/.*(mlb\/[^/?#]+)$/

// Asset filenames that only ever come out of a stills pipeline. The bare UUID
// prefix is an MLB Photos/Greenfly asset id — MLB appends the shooter's
// surname to some of them (`f6411e6b-...Vasquez`) and a numeric thumbnail id
// to others; both are photographer uploads, so the prefix alone is the test.
const PHOTOGRAPHER_NAME_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /(^|[^a-z])getty\s*images?[-_ ]?\d{6,}/i,
  /(^|[^a-z0-9])ap[-_ ]?\d{10,}/i,
  /[-_](getty|ap|greenfly|usatsi|imagn|reuters)[-_]/i,
]

const SIXTEEN_BY_NINE = 16 / 9
// Wide enough to absorb a rounding-off encode (1279x720 reads as 1.7764) while
// still rejecting a 3:2 still by a mile (1.5 is 0.28 away).
const ASPECT_TOLERANCE = 0.01
// Statcast cards render at 1920x1080; broadcast frame grabs come off the feed
// at 1280x720. Nothing observed lands between them.
const GRAPHIC_MIN_WIDTH = 1920

const KIND_ORDER = { photographer: 0, broadcast: 1, unknown: 2, graphic: 3 }

// Taxonomy values that mean the CLIP is a rendered card. Only consulted for an
// asset already known to be 16:9 (see the header), and only for what the width
// threshold alone would miss: every `darkroom-*` card renders at 1920x1080 and
// every `game-recap` card at 1920 or 2560, so those are already caught — but a
// `condensed-game` card ("CONDENSED GAME" over the two clubs' marks) is served
// at 1280x720, indistinguishable by shape from a frame grab.
//
// A bare `data-visualization` tag is deliberately NOT in this set even though
// it reads like the obvious member. It marks two different things: the real
// Statcast cards (which also carry `darkroom-*`, and are 1920 wide anyway) and
// MLB's "Data Viz: <player>'s 440-foot home run" clips, whose thumbnail is an
// ordinary 1280x720 broadcast frame. Including it dropped those frames — a
// photo the page should show — so the narrower tags do the work instead.
function isGraphicTaxonomy(taxonomy) {
  return taxonomy.some(
    (value) =>
      value.startsWith('darkroom-') || value === 'game-recap' || value === 'condensed-game',
  )
}

// Strip the resize/crop transform segment from an mlbstatic CDN URL, e.g.
// `.../upload/t_16x9/t_w2208/mlb/xxxx.jpg` -> `.../upload/mlb/xxxx.jpg`. Null
// for anything that isn't a real mlbstatic upload URL (the content feed also
// carries an unresolved `{formatInstructions}` template string some places,
// which this rejects since it has no `mlb/` id segment of its own — it's
// literally the word `{formatInstructions}` in the path).
function originalPhotoUrl(url) {
  const m = UPLOAD_RE.exec(url ?? '')
  if (!m) return null
  let id = m[1]
  if (id.includes('{')) return null
  if (!/\.[a-z]{3,4}$/i.test(id)) id = `${id}.jpg` // template rows carry no extension
  return `${CDN_PREFIX}${id}`
}

// A resized preview for the grid — same CDN, same photo id, just a modest
// width so the page doesn't pull down 41 originals at 6-12MB apiece just to
// render thumbnails.
function thumbUrl(original, width = 480) {
  return original.replace(`${CDN_PREFIX}`, `${CDN_PREFIX}w_${width}/`)
}

// Recursively walk the content feed for every mlbstatic photo URL, deduping
// by photo id (the feed repeats each photo many times over — once per crop/
// density variant the site itself might use).
function collectPhotoUrls(node, seen) {
  if (node == null) return
  if (typeof node === 'string') {
    const original = originalPhotoUrl(node)
    if (original) seen.set(original.slice(CDN_PREFIX.length), original)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectPhotoUrls(item, seen)
    return
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) collectPhotoUrls(value, seen)
  }
}

// `keywordsAll` entries look like `{ type: 'player', value: 'playerid-680776',
// displayName: 'Jarren Duran' }`. The numeric tail is the same personId
// Headshot.jsx takes and the same teamId teams.js keys everything on, so this
// returns ids rather than names — no name matching anywhere downstream.
function keywordEntries(keywords, type) {
  const prefix = `${type}id-`
  const out = []
  for (const entry of keywords) {
    if (entry?.type !== type || typeof entry.value !== 'string') continue
    if (!entry.value.startsWith(prefix)) continue
    const id = Number(entry.value.slice(prefix.length))
    if (!Number.isFinite(id)) continue
    out.push({ id, name: typeof entry.displayName === 'string' ? entry.displayName : '' })
  }
  return out
}

// Who and what a photo is OF. Measured over 431 assets: a photographer still
// carries exactly one team 110/110 times and exactly one player 105/110, so
// the first tagged entry is the subject and the full lists exist for querying
// (a montage clip tags two or three players). A graphic mostly carries neither
// — only 19/59 had a player — which is an independent confirmation of the
// three-way split above.
//
// This names the SUBJECT, not everyone in the frame: a photo of a Rockies
// batter also shows the Brewers catcher, and only Colorado is tagged.
function focusFrom(keywords) {
  const players = keywordEntries(keywords, 'player')
  const teams = keywordEntries(keywords, 'team')
  return {
    playerId: players[0]?.id ?? null,
    playerName: players[0]?.name ?? '',
    teamId: teams[0]?.id ?? null,
    teamName: teams[0]?.name ?? '',
    playerIds: players.map((p) => p.id),
    teamIds: teams.map((t) => t.id),
  }
}

// The original upload's true pixel dimensions, without downloading it.
// Cloudinary's `fl_getinfo` answers with `{input: {width, height, bytes}}`.
// MLB's own `image.cuts` can't stand in for this — those are its forced 16:9
// renditions, so every asset looks 16:9 through them whatever its real shape.
// Null on any failure, which classifies as `unknown` rather than guessing.
async function fetchAssetShape(id) {
  try {
    const res = await fetch(`${CDN_PREFIX}fl_getinfo/${id}`)
    if (!res.ok) return null
    const body = await res.json()
    const width = body?.input?.width
    const height = body?.input?.height
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return null
    return { width, height }
  } catch {
    return null
  }
}

// Pure classifier — see the module header for the evidence behind each step.
// Exported for the unit suite, which pins the ordering: a name-identified
// still must win before any shape is consulted, and taxonomy must never
// promote a non-16:9 asset to `graphic`.
export function classifyPhotoAsset({ title = '', taxonomy = [], shape = null } = {}) {
  if (PHOTOGRAPHER_NAME_PATTERNS.some((re) => re.test(title ?? ''))) return 'photographer'
  if (!shape) return 'unknown'
  const aspect = shape.width / shape.height
  if (Math.abs(aspect - SIXTEEN_BY_NINE) >= ASPECT_TOLERANCE) return 'photographer'
  if (isGraphicTaxonomy(taxonomy) || shape.width >= GRAPHIC_MIN_WIDTH) return 'graphic'
  return 'broadcast'
}

// Every distinct high-res photo MLB's content package carries for a game, as
// `{ id, original, thumb, kind, headline, focus }`. Two passes: the highlight
// items first, which is the only place attribution lives, then the legacy
// recursive walk to sweep up any URL parked elsewhere in the payload (an
// `editorial` article photo, say) — those keep their `kind` classification but
// have no subject to report. Degrades to [] on failure or a game with no
// editorial content package yet (common for a game that just started, or most
// MiLB games).
export async function fetchGamePhotos(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/content`)
    const rows = new Map()

    for (const item of data?.highlights?.highlights?.items ?? []) {
      const image = item?.image
      const original =
        originalPhotoUrl(image?.templateUrl) ?? originalPhotoUrl(image?.cuts?.[0]?.src)
      if (!original) continue
      const id = original.slice(CDN_PREFIX.length)
      if (rows.has(id)) continue
      const keywords = Array.isArray(item?.keywordsAll) ? item.keywordsAll : []
      rows.set(id, {
        id,
        original,
        thumb: thumbUrl(original),
        title: typeof image?.title === 'string' ? image.title : '',
        taxonomy: keywords
          .filter((k) => k?.type === 'taxonomy' && typeof k.value === 'string')
          .map((k) => k.value),
        headline: typeof item?.headline === 'string' ? item.headline.trim() : '',
        focus: focusFrom(keywords),
      })
    }

    const strays = new Map()
    collectPhotoUrls(data, strays)
    for (const [id, original] of strays) {
      if (rows.has(id)) continue
      rows.set(id, {
        id,
        original,
        thumb: thumbUrl(original),
        title: '',
        taxonomy: [],
        headline: '',
        focus: focusFrom([]),
      })
    }

    const photos = [...rows.values()]
    // One small probe per asset that its filename didn't already settle. Run
    // together rather than in sequence — a 40-photo game would otherwise stack
    // 40 round-trips before the grid could render.
    await Promise.all(
      photos.map(async (photo) => {
        if (PHOTOGRAPHER_NAME_PATTERNS.some((re) => re.test(photo.title))) {
          photo.kind = 'photographer'
          return
        }
        const shape = await fetchAssetShape(photo.id)
        photo.kind = classifyPhotoAsset({ title: photo.title, taxonomy: photo.taxonomy, shape })
      }),
    )

    return photos
      .map(({ title: _title, taxonomy: _taxonomy, ...photo }) => photo)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  } catch {
    return []
  }
}

// Everything shot by a camera — a photographer's still or a frame off the
// broadcast — dropping the rendered cards. `unknown` is kept deliberately: it
// only arises when the shape probe failed, and a silently-dropped photo is a
// worse outcome on this page than a stray graphic slipping through.
export function withoutGraphics(photos) {
  return (photos ?? []).filter((photo) => photo.kind !== 'graphic')
}

// Subject lookups, matched against every tagged id rather than just the
// primary, so a montage tagging three players is found under all three.
// `photosForTeam` backs the Team Page's Photos rail (TeamPage.jsx); no
// screen calls `photosForPlayer` yet.
export function photosForPlayer(photos, personId) {
  if (personId == null) return []
  return (photos ?? []).filter((photo) => photo.focus?.playerIds?.includes(Number(personId)))
}

export function photosForTeam(photos, teamId) {
  if (teamId == null) return []
  return (photos ?? []).filter((photo) => photo.focus?.teamIds?.includes(Number(teamId)))
}

// The Team Page's Photos rail's stricter filter: camera stills only,
// dropping BOTH broadcast frame grabs and rendered graphic cards (Statcast
// darkroom cards, ABS challenge result cards, GAME HIGHLIGHTS recap art —
// all `kind: 'graphic'`). `withoutGraphics` above keeps broadcast frames;
// this is for a surface that wants photographer work only.
export function onlyPhotographer(photos) {
  return (photos ?? []).filter((photo) => photo.kind === 'photographer')
}

// The single best still for a game, for scripts/gen-highlights.mjs's day
// index — the home slate's revealed result cards use this as the condensed
// game's poster instead of MLB's own "CONDENSED GAME" graphic card. Takes the
// highlight ITEMS array the generator already fetched via fetchHighlights()
// for that same game (no second content request), so it only ever sees the
// attributed pass — never the recursive stray walk fetchGamePhotos does, which
// needs the full content payload this call site doesn't have. That cost every
// game in a 30-game live sample (2026-08-07) exactly nothing: all 30 resolved
// to a `photographer` still off the attributed items alone.
//
// EARLY-EXITS the moment a `photographer` candidate turns up — the top rank
// KIND_ORDER assigns, so nothing later in the list can beat it. That is what
// keeps this affordable in a nightly sweep: the common case costs a title
// check and at most a couple of shape probes, not one probe per photo the way
// fetchGamePhotos pays (that function has to classify EVERY photo for its
// gallery; this one only needs the first best one). Falls back to the first
// `broadcast` frame if no photographer still exists, and to `null` if the game
// has nothing usable — same "fail open, never guess" posture as
// classifyPhotoAsset.
//
// RETURNS BARE URLs ONLY — no `headline`, no `focus`. This feeds
// public/data/highlights/day/<date>.json, which the slate fetches whole for
// EVERY game on the date the instant the page loads, regardless of which of
// those games the visitor has actually revealed yet (see gen-highlights.mjs's
// day-index comment) — so nothing legible as plain text may ride along, same
// reason that file stores the condensed cut's structural title and never the
// recap's. A photo URL is safe there by the reasoning that already covers that
// same file's condensed-cut poster/playback URLs: GameResultFace.jsx renders
// it only once the flip card's already-revealed back face has mounted, so nothing
// paints before the visitor chose to reveal that specific game.
//
// `width` sizes the `thumb` render only — same photograph, same CDN id, just a
// different resize instruction. The 480 default is the slate card's size and is
// what the day index stores; the box score asks for a wider one because its
// condensed print fills a half-page column on a desktop, where 480 reads soft.
export async function pickHeroPhoto(items, { width = 480 } = {}) {
  const seen = new Set()
  let fallback = null
  for (const item of items ?? []) {
    const image = item?.image
    const original = originalPhotoUrl(image?.templateUrl) ?? originalPhotoUrl(image?.cuts?.[0]?.src)
    if (!original) continue
    const id = original.slice(CDN_PREFIX.length)
    if (seen.has(id)) continue
    seen.add(id)

    const title = typeof image?.title === 'string' ? image.title : ''
    let kind
    if (PHOTOGRAPHER_NAME_PATTERNS.some((re) => re.test(title))) {
      kind = 'photographer'
    } else {
      const keywords = Array.isArray(item?.keywordsAll) ? item.keywordsAll : []
      const taxonomy = keywords
        .filter((k) => k?.type === 'taxonomy' && typeof k.value === 'string')
        .map((k) => k.value)
      const shape = await fetchAssetShape(id)
      kind = classifyPhotoAsset({ title, taxonomy, shape })
    }

    if (kind === 'photographer') return { original, thumb: thumbUrl(original, width) }
    if (kind === 'broadcast' && !fallback) fallback = { original, thumb: thumbUrl(original, width) }
  }
  return fallback
}
