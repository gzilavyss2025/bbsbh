// Ballpark ARTWORK — the photograph of each park, its required credit, and the
// optional wordmark logo that can stand in for the park's typeset name.
//
// Split from ballparkData.js on purpose. That file is MEASUREMENTS (distances,
// wall heights, capacity) — facts with no owner. This one is IMAGES, which come
// with authorship and a licence, and those two things age differently: a fence
// gets moved once a decade, a photo gets swapped whenever a better one turns up.
//
// Keyed by the SAME normalized venue name as ballparkData.js — but callers pass
// the park record's CANONICAL `name`, not the raw feed venue string. BALLPARKS
// holds 33 keys for 30 parks, because a renamed park keeps an alias key pointing
// at one shared record ("Minute Maid Park" -> the Daikin Park record). Looking
// art up by `park.name` means every alias resolves to the same photo for free,
// and a future rename needs no second image.
//
// PHOTOS. Every file in public/ballparks/ is public domain, CC0, CC BY, or
// CC BY-SA — no fair-use, no hotlinking, no third-party host at runtime, the
// same self-contained posture as ballparkData.js. They were pulled once from
// Wikimedia Commons at 1000px wide (see docs/ballpark-photos.md for the refresh
// recipe). CC BY and CC BY-SA REQUIRE visible attribution, which is why
// `credit` is not optional metadata: BallparkCard renders it under the photo,
// and dropping that caption would put the app out of licence compliance. If you
// replace a photo, replace its CREDITS entry in the same commit.
//
// LOGOS. Deliberately EMPTY on purpose, not unfinished. A ballpark's own
// wordmark ("Fenway Park" script, the Coors Field mark) is a sponsor's
// registered trademark; the copies floating around Wikipedia are uploaded under
// fair-use claims that do not travel to a third-party site. So nothing is
// bundled. The slot is real and ready: drop a file at
// public/ballparks/logos/{key}.svg (or .png) and add its key to LOGO_KEYS, and
// the card swaps the typeset name for it. Anything not listed falls back to the
// typeset wordmark, which is the deliberate default for all 30 parks today.
//
// There are now TWO ways to fill that slot, and BUNDLED IS NOT THE PRIMARY ONE.
// LOGO_KEYS is the deploy-time route above. The other is `ballpark.{key}
// Wordmark` in the copy store, which the owner can set from the card itself —
// and because that route can be exercised in production by one person in a few
// seconds, it is the one that will actually get used. The override WINS over a
// bundled key (resolveParkName below): a file committed to the repo is the
// shipped default, and the copy store is how a default gets overridden
// everywhere else in this app. The trademark caution above applies to both
// routes equally — the licence question does not care which door the image came
// through.

// Normalize a venue name to a stable lookup key (mirrors ballparkData.js).
// "Oriole Park at Camden Yards" -> "orioleparkatcamdenyards". Exported because
// the copy registry derives one admin-editable note id per park from it, and
// those ids are Redis field names — if this and the CREDITS keys ever drifted,
// a saved note would silently detach from its park.
export function venueKey(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// The five admin-editable copy fields one park owns, as dotted registry ids.
//
// Lives HERE, beside venueKey, because this file already owns the key scheme
// those ids are built from — and because there are now two unrelated readers of
// them: the Ballpark card's editor (screens/team/modules/ballpark/) and the
// slate card's backdrop (./parkBackdrop.js). A copy of the naming scheme in
// either one would be a copy that can drift, and these ids are Redis field
// names: a park whose id moved would silently lose the photograph somebody
// uploaded for it. The registry (src/copy/registry.js) derives the same names
// from the same key; keep the two in step.
export function fieldIds(key) {
  return {
    name: `ballpark.${key}Name`,
    wordmark: `ballpark.${key}Wordmark`,
    photo: `ballpark.${key}Photo`,
    credit: `ballpark.${key}Credit`,
    focus: `ballpark.${key}Focus`,
  }
}

// artist / license / source for each bundled photo. `source` is the Commons
// file page, which is where a reader goes to verify the licence.
export const CREDITS = {
  americanfamilyfield: { artist: 'Carol H. Highsmith', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File%3AMiller_Park_in_Milwaukee%2C_Wisconsin.jpg' },
  angelstadium: { artist: 'CrispyCream27', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AAngelstadiummarch2019.jpg' },
  buschstadium: { artist: 'Lightmetro', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ABusch_Stadium_2022.jpg' },
  chasefield: { artist: 'U.S. Air Force photo by Staff Sgt. Tyler J. Bolken', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File%3AReserve_A-10_Warthogs_Flyover_2023_World_Series_(8099146).jpg' },
  citifield: { artist: 'Jeffme', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File%3ACiti_Field_from_the_south_2025.jpg' },
  citizensbankpark: { artist: 'Chris6d', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ACitizens_Bank_Park_2021.jpg' },
  comericapark: { artist: 'User MJCdetroit on en.wikipedia', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File%3ADetroit_Tigers_opening_game_at_Comerica_Park%2C_2007.jpg' },
  coorsfield: { artist: 'Thelastcanadian', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ACoors_Field_July_2015.jpg' },
  daikinpark: { artist: 'Another Believer', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AHouston%2C_Texas_(2024)_-_09.jpg' },
  dodgerstadium: { artist: 'Spatms', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ADodger_Stadium_and_Chavez_Ravine_far_view%2C_Chicago_Cubs_at_Los_Angeles_Dodgers%2C_(April_12%2C_2025).jpg' },
  fenwaypark: { artist: 'Rick Berry', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File%3A131023-F-PR861-033_Hanscom_participates_in_World_Series_pregame_events.jpg' },
  globelifefield: { artist: 'slgckgc', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File%3AGlobeLifeField2021.jpg' },
  greatamericanballpark: { artist: 'Laslovarga', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3A10Cincinnati_2015_(2).jpg' },
  journeybankballpark: { artist: 'Ruhrfisch', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Bowman_Field_MLB_Little_League_Classic_2018_03.jpg' },
  kauffmanstadium: { artist: 'Chibears85', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AKauffman2017.jpg' },
  loandepotpark: { artist: 'Ven-Lib', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ALOAN_DEPOT_PARK.jpg' },
  nationalspark: { artist: 'APK', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ANationals_Park_8.16.19_-_7.jpg' },
  oraclepark: { artist: 'Chris6d', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AOracle_Park_2021.jpg' },
  orioleparkatcamdenyards: { artist: 'Aspifi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AOrioleParkatCamdenYardsSummer2025.jpg' },
  petcopark: { artist: 'Mds08011', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File%3APetco_Park_Padres_Game.jpg' },
  pncpark: { artist: 'Joshua Peacock jcpeacock', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File%3APittsburgh_Pirates_park_(Unsplash).jpg' },
  progressivefield: { artist: 'Erik Drost', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File%3ACleveland_Guardians_vs._New_York_Yankees_on_Oct_17_2024_(54102149292).jpg' },
  ratefield: { artist: 'Another Believer', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AChicago%2C_Illinois%2C_U.S._(2023)_-_062.jpg' },
  rogerscentre: { artist: 'JFVoll', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ARogers_Centre_(500_Level)_-_Toronto%2C_ON.jpg' },
  sutterhealthpark: { artist: 'Quintin Soloviev', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File%3ASutter_Health_Park_aerial_view_2023_(Quintin_Soloviev).jpg' },
  targetfield: { artist: 'Ken Lund from Reno, Nevada, USA', license: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File%3ATarget_Field%2C_Minneapolis%2C_Minnesota_(43167053335).jpg' },
  tmobilepark: { artist: 'MyName (Cacophony)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File%3ASafecoFieldTop.jpg' },
  tropicanafield: { artist: 'Vmartin12', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3APXL_20220528_205520913.jpg' },
  truistpark: { artist: 'TarheelBornBred', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File%3ATruist_Park_2025.jpg' },
  wrigleyfield: { artist: 'Sea Cow', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File%3AWrigley_Field_in_line_with_sign.jpg' },
  yankeestadium: { artist: 'vtravelled.com', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File%3AYankee_Stadium_overhead_2010.jpg' },
}

// Parks whose own wordmark art is on file, with the extension it is stored as.
// Empty by design — see the LOGOS note in the header before adding one.
export const LOGO_KEYS = {}

// Parks whose commemorative STAMP illustration is on file, with the extension
// it is stored as. Same manifest shape as LOGO_KEYS above and for the same
// reason: the browser cannot stat public/, so a committed file needs a listed
// key before anything will ask for it. That is what lets the series land in
// BATCHES — every park not listed here keeps rendering its photograph, so a
// half-finished set is 8 stamps and 22 photos rather than 22 broken images.
// Add a key in the SAME commit as its file, exactly as LOGO_KEYS requires.
export const STAMP_KEYS = {}

// The bundled photo for a park, or null when we have no art for it. Returns the
// URL and the credit together because the caller may never render one without
// the other (CC BY / CC BY-SA attribution).
export function ballparkPhoto(parkName) {
  const key = venueKey(parkName)
  const credit = CREDITS[key]
  if (!credit) return null
  return { src: `/ballparks/${key}.jpg`, credit }
}

// The park's own wordmark, or null to fall back to the typeset name.
export function ballparkLogoUrl(parkName) {
  const key = venueKey(parkName)
  const ext = LOGO_KEYS[key]
  return ext ? `/ballparks/logos/${key}.${ext}` : null
}

// The mobile-sized companion to a bundled photo — a ~480px WebP the slate
// card's touch/scroll reveal uses instead of the 1000px JPEG a hover pointer
// arms (parkBackdrop.js, 06a-gamecard-parkart.css). Built by
// scripts/gen-ballpark-thumbs.mjs from the same CREDITS set this function
// reads, so every bundled park has one the moment that script has run; an
// admin's own photo (ADR-0044) never does, since that upload has no build
// step to make one in — resolvePhoto falls back to the full URL for those.
export function ballparkPhotoThumb(parkName) {
  const key = venueKey(parkName)
  if (!CREDITS[key]) return null
  return { src: `/ballparks/thumb/${key}.webp` }
}

// The commemorative stamp illustration for a park, or null when the series has
// not reached it yet. Deliberately does NOT fall back to the photograph — the
// caller decides that, because the two are not interchangeable everywhere: the
// milestone shelf wants either, while a surface that needs a real photograph
// must not be handed an illustration of one.
export function ballparkStampArt(parkName) {
  const key = venueKey(parkName)
  const ext = STAMP_KEYS[key]
  return ext ? { src: `/ballparks/stamp/${key}.${ext}` } : null
}

// One line of attribution, worded so it satisfies CC BY / CC BY-SA without
// reading like legal boilerplate on a scorebook page. Public-domain and CC0
// photos need no credit at all, but naming the photographer anyway costs one
// line and is the decent thing to do.
export function creditLine(credit) {
  if (!credit) return ''
  const who = credit.artist || 'Unknown'
  return credit.license === 'Public domain' || credit.license === 'CC0'
    ? `Photo: ${who}`
    : `Photo: ${who} · ${credit.license}`
}

// Dead centre — what an unset focal point means.
const CENTRE = '50% 50%'

// Resolve what the card should actually show for a park: the bundled photo, or
// the admin's replacement, plus the credit and crop that go with whichever won.
//
// `overrides` is the three admin fields for this park ({ photo, credit, focus }),
// already sanitized by the copy registry — `photo` matched an https:// URL and
// `focus` matched "x y" with both numbers 0–100, or they were dropped before
// reaching here. This function does NOT re-validate; it assumes the registry's
// choke point held, the same assumption every other consumer of resolved copy
// makes.
//
// The CREDIT is the subtle part. A bundled photo carries a Commons credit and a
// `source` page we can link to, which is how the app satisfies CC BY / CC BY-SA
// (see the PHOTOS note above). An admin's own photo carries NEITHER unless they
// typed a credit, so an override deliberately DROPS the bundled attribution
// rather than inheriting it — leaving Carol H. Highsmith's name under somebody
// else's photograph would be a worse failure than showing no credit at all.
// `thumbSrc` always carries a value — a bundled park's real thumbnail, or the
// full `src` again for anything that has no smaller companion (an admin
// override, or a bundled park whose thumbnail hasn't been generated yet), so
// every caller can read `photo.thumbSrc` with no null check.
export function resolvePhoto(parkName, overrides = {}) {
  const bundled = ballparkPhoto(parkName)
  const focus = overrides.focus ? toObjectPosition(overrides.focus) : CENTRE

  if (overrides.photo) {
    const text = overrides.credit || ''
    return { src: overrides.photo, thumbSrc: overrides.photo, focus, creditText: text, creditHref: null, isOverride: true }
  }
  if (!bundled) return null
  const thumb = ballparkPhotoThumb(parkName)
  return {
    src: bundled.src,
    thumbSrc: thumb?.src || bundled.src,
    focus,
    creditText: creditLine(bundled.credit),
    creditHref: bundled.credit.source,
    isOverride: false,
  }
}

// How the park should be NAMED on the card: as an image if there is a wordmark,
// otherwise as text. Returns both halves every time — `text` is never empty even
// when a wordmark wins, because it is still the image's alt text and its title,
// and a wordmark that fails to load must leave a readable name behind rather
// than a blank space where the park's identity was.
//
// Precedence, widest to narrowest: the feed's canonical park name, then the
// admin's typed `name`, then the admin's `wordmark` image. The two overrides are
// independent on purpose — setting a wordmark for a renamed park should not
// force the owner to also retype the name it is a picture OF, and typing a name
// should not have to mean giving up an image they already uploaded.
//
// `overrides` is already sanitized by the copy registry (the wordmark matched an
// https:// URL or was dropped), so this does not re-validate — the same
// assumption resolvePhoto makes.
export function resolveParkName(parkName, overrides = {}) {
  const text = overrides.name || parkName || ''
  return { text, wordmark: overrides.wordmark || ballparkLogoUrl(parkName) || null }
}

// "50 20" -> "50% 20%". The registry already guaranteed the shape; anything
// else falls back to centre rather than emitting a broken CSS value.
function toObjectPosition(focus) {
  const [x, y] = String(focus).trim().split(/\s+/)
  if (x === undefined || y === undefined) return CENTRE
  return `${Number(x)}% ${Number(y)}%`
}
