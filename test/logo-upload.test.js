import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import zlib from 'node:zlib'

import {
  LOGO_MAX_BYTES,
  LOGO_SIZE,
  LOGO_TREATMENT_DIRS,
  MILB_LOGO_DIRS,
  describeLogoCaveat,
  describeLogoRejection,
  logoUploadTarget,
  readPngHeader,
  teamIdForAbbr,
  wpaArtTreatmentKey,
  wpaArtUrl,
} from '../src/lib/logoArt.js'
import {
  DEV_LOGO_COPY_ROUTE,
  DEV_LOGO_MAX_BODY_BYTES,
  DEV_LOGO_ROUTE,
  buildLogoManifest,
  prepareLogoCopy,
  prepareLogoUpload,
  resolveLogoFile,
} from '../scripts/lib/dev-logo-upload.mjs'
import { devDataStore } from '../scripts/lib/dev-data-stores.mjs'
import LOGO_ART from '../src/lib/data/logo-art.json' with { type: 'json' }

// The /__dev/team-logo upload (ADR-0029). Two things need pinning: the PNG
// validator, because it is hand-rolled against the byte layout rather than
// delegated to an image library, and the destination allowlist, because it is a
// security boundary — a request supplies a team id and a treatment key, never a
// path, and there must be no way from one to a file outside
// public/team-logos/{allowed treatment}/.

// --------------------------------------------------------------------------
// Real PNGs, built here rather than checked in as fixtures — the validator
// reads actual header bytes, so a test that hand-assembles those bytes would
// only be checking itself.
// --------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tag, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// A valid, decodable PNG of the given size. `level: 0` writes the pixel data as
// stored (uncompressed) deflate blocks, which is how the oversized case gets to
// be genuinely too big without generating a megabyte of random noise.
function makePng(width, height, { colorType = 6, level = 9 } = {}) {
  const channels = { 6: 4, 4: 2, 2: 3, 0: 1 }[colorType]
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = colorType
  // 10-12: compression 0, filter 0, interlace 0 — all already zero.
  const raw = Buffer.alloc(height * (1 + width * channels)) // each row: filter byte 0, then pixels
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// A real JPEG's opening bytes: SOI + APP0/JFIF. Renaming one to .png is the
// mistake most likely to reach this endpoint, so it gets a real header rather
// than arbitrary junk.
const JPEG_HEADER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from('JFIF\0', 'ascii'),
  Buffer.alloc(64),
])

// --------------------------------------------------------------------------
// The validator — the four cases the PR prompt names, plus the degenerate ones
// --------------------------------------------------------------------------

test('a 512x512 PNG is accepted, and its header reads back correctly', () => {
  const png = makePng(LOGO_SIZE, LOGO_SIZE)
  assert.equal(describeLogoRejection(png), null)
  assert.deepEqual(readPngHeader(png), {
    width: 512,
    height: 512,
    bitDepth: 8,
    colorType: 6,
    alpha: true,
  })
})

test('a wrong-size PNG is rejected, and the message names both sizes', () => {
  const problem = describeLogoRejection(makePng(1280, 1280))
  assert.match(problem, /1280x1280/)
  assert.match(problem, /exactly 512x512/)
  // Off by one in a single dimension is still off.
  assert.match(describeLogoRejection(makePng(512, 511)), /512x511/)
})

test('a JPEG renamed .png is rejected as a format problem, not a size one', () => {
  const problem = describeLogoRejection(JPEG_HEADER)
  assert.match(problem, /not a PNG/)
  assert.equal(readPngHeader(JPEG_HEADER), null)
})

test('an oversized PNG is rejected even at exactly the right dimensions', () => {
  const png = makePng(LOGO_SIZE, LOGO_SIZE, { level: 0 })
  assert.ok(png.length > LOGO_MAX_BYTES, 'the fixture must actually exceed the cap')
  assert.equal(readPngHeader(png).width, 512, 'it is still a valid 512x512 PNG')
  assert.match(describeLogoRejection(png), /the cap is 400 KB/)
})

test('an empty or truncated file is rejected before anything reads a dimension', () => {
  assert.match(describeLogoRejection(Buffer.alloc(0)), /empty/)
  assert.match(describeLogoRejection(new Uint8Array(0)), /empty/)
  assert.match(describeLogoRejection(null), /empty/)
  // The signature alone, with no IHDR chunk behind it.
  assert.match(
    describeLogoRejection(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    /not a PNG/,
  )
})

test('a PNG without an alpha channel passes, with a caveat rather than a rejection', () => {
  const flat = makePng(LOGO_SIZE, LOGO_SIZE, { colorType: 2 })
  assert.equal(describeLogoRejection(flat), null)
  assert.match(describeLogoCaveat(flat), /no alpha channel/)
  assert.equal(describeLogoCaveat(makePng(LOGO_SIZE, LOGO_SIZE)), null)
})

// --------------------------------------------------------------------------
// The destination allowlist
// --------------------------------------------------------------------------

test('a real club and treatment resolve to the one file they may write', () => {
  assert.deepEqual(logoUploadTarget(140, 'alternate'), {
    teamId: 140,
    treatment: 'alternate',
    abbr: 'TEX',
    dir: 'alternate',
    name: 'TEX.png',
    file: 'public/team-logos/alternate/TEX.png',
    url: '/team-logos/alternate/TEX.png',
  })
  // Main art is the hand-recolored override, in its own directory.
  assert.equal(logoUploadTarget(158, 'main').file, 'public/team-logos/main-overrides/MIL.png')
  assert.equal(logoUploadTarget(147, 'city-connect').file, 'public/team-logos/city-connect/NYY.png')
})

test('every real MLB treatment has its own WPA-only upload destination', () => {
  assert.deepEqual(logoUploadTarget(140, 'main-wpa'), {
    teamId: 140,
    treatment: 'main-wpa',
    abbr: 'TEX',
    dir: 'wpa-main',
    name: 'TEX.png',
    file: 'public/team-logos/wpa-main/TEX.png',
    url: '/team-logos/wpa-main/TEX.png',
  })
  assert.equal(logoUploadTarget(140, 'alternate-wpa').file, 'public/team-logos/wpa-alternate/TEX.png')
  assert.equal(logoUploadTarget(140, 'alternate-2-wpa').file, 'public/team-logos/wpa-alternate-2/TEX.png')
  assert.equal(logoUploadTarget(140, 'alternate-3-wpa').file, 'public/team-logos/wpa-alternate-3/TEX.png')
  assert.equal(logoUploadTarget(140, 'alternate-4-wpa').file, 'public/team-logos/wpa-alternate-4/TEX.png')
  assert.equal(logoUploadTarget(140, 'city-connect-wpa').file, 'public/team-logos/wpa-city-connect/TEX.png')
  // MiLB has no WPA-only destination — its two directories aren't real
  // treatments and don't grow a `-wpa` sibling.
  assert.equal(logoUploadTarget(234, 'milb-home-wpa'), null)
  assert.equal(logoUploadTarget(234, 'milb-away-wpa'), null)
})

test('wpaArtTreatmentKey/wpaArtUrl derive the same destination the upload itself resolves', () => {
  assert.equal(wpaArtTreatmentKey('alternate'), 'alternate-wpa')
  assert.equal(wpaArtTreatmentKey('milb-home'), null) // no such destination
  assert.equal(wpaArtTreatmentKey('bogus'), null)
  assert.equal(wpaArtUrl(140, 'main'), logoUploadTarget(140, 'main-wpa').url)
  assert.equal(wpaArtUrl(234, 'main'), null) // MiLB id, no MLB abbreviation
})

test('a MiLB affiliate resolves to its id-keyed file under milb-home/milb-away', () => {
  assert.deepEqual(logoUploadTarget(234, 'milb-home'), {
    teamId: 234,
    treatment: 'milb-home',
    abbr: null,
    dir: 'milb-home',
    name: '234.png',
    file: 'public/team-logos/milb-home/234.png',
    url: '/team-logos/milb-home/234.png',
  })
  assert.equal(logoUploadTarget(234, 'milb-away').file, 'public/team-logos/milb-away/234.png')
  // MiLB has no closed team-id catalog to check an id against (unlike the
  // MLB-abbreviation path above, which only resolves for the 30 real clubs) —
  // any positive integer id, including an MLB club's own, is a valid MiLB
  // destination.
  assert.equal(logoUploadTarget(140, 'milb-home').file, 'public/team-logos/milb-home/140.png')
})

test('a non-positive or non-integer id has no MiLB destination either', () => {
  assert.equal(logoUploadTarget(0, 'milb-home'), null)
  assert.equal(logoUploadTarget(-5, 'milb-home'), null)
  assert.equal(logoUploadTarget(NaN, 'milb-home'), null)
  assert.equal(logoUploadTarget(234.5, 'milb-home'), null)
})

test('an unknown treatment has no destination at all', () => {
  assert.equal(logoUploadTarget(140, 'alternate-9'), null)
  assert.equal(logoUploadTarget(140, ''), null)
  assert.equal(logoUploadTarget(140, 'main-overrides'), null) // the directory, not the treatment key
})

// The treatment is the only request-supplied string anywhere near a path, so
// every shape that could carry one has to come back with no destination.
test('a traversal-shaped or prototype treatment has no destination', () => {
  for (const treatment of [
    '../../../etc/passwd',
    'alternate/../../..',
    './alternate',
    'alternate\\..\\..',
    '__proto__',
    'constructor',
    'toString',
  ]) {
    assert.equal(logoUploadTarget(140, treatment), null, `"${treatment}" resolved to a destination`)
  }
})

test('a team id that is not one of the 30 MLB clubs has no destination', () => {
  assert.equal(logoUploadTarget(234, 'alternate'), null) // Durham Bulls — MiLB art is PR 4's, keyed by id
  assert.equal(logoUploadTarget(9999, 'alternate'), null)
  assert.equal(logoUploadTarget(0, 'alternate'), null)
  assert.equal(logoUploadTarget(NaN, 'alternate'), null)
  assert.equal(logoUploadTarget(140.5, 'alternate'), null)
  assert.equal(logoUploadTarget('140', 'alternate'), null)
  assert.equal(logoUploadTarget(null, 'alternate'), null)
})

test('every allowlisted treatment directory is a bare directory name', () => {
  for (const [treatment, dir] of Object.entries(LOGO_TREATMENT_DIRS)) {
    assert.match(treatment, /^[a-z0-9-]+$/)
    assert.match(dir, /^[a-z0-9-]+$/, `${treatment} maps to a non-bare directory`)
  }
})

// Defense in depth on the resolution itself: the allowlist's entries are
// literals, so this can only fire on a careless future edit — which is exactly
// when it should.
test('a destination outside the art directories throws rather than resolving', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..')
  assert.equal(resolveLogoFile(logoUploadTarget(140, 'alternate')), path.join(repoRoot, 'public/team-logos/alternate/TEX.png'))
  assert.equal(
    resolveLogoFile(logoUploadTarget(234, 'milb-home')),
    path.join(repoRoot, 'public/team-logos/milb-home/234.png'),
  )
  assert.throws(
    () => resolveLogoFile({ dir: 'milb-home', name: '02.png', file: 'public/team-logos/milb-home/02.png' }),
    /escapes the art directories/,
    'a leading-zero id is not a bare positive integer',
  )
  assert.throws(
    () => resolveLogoFile({ dir: 'alternate', name: 'TEX.png', file: 'public/team-logos/alternate/../../../TEX.png' }),
    /escapes the art directories/,
  )
  assert.throws(
    () => resolveLogoFile({ dir: '../../src/lib', name: 'TEX.png', file: 'public/team-logos/../../src/lib/TEX.png' }),
    /escapes the art directories/,
  )
  assert.throws(
    () => resolveLogoFile({ dir: 'alternate', name: 'teams.js', file: 'public/team-logos/alternate/teams.js' }),
    /escapes the art directories/,
  )
  assert.throws(
    () => resolveLogoFile({ dir: 'alternate', name: 'TEX.png', file: 'public/team-logos/TEX.png' }),
    /escapes the art directories/,
  )
})

test('the endpoint refuses a bad destination and a bad file with a reason each', () => {
  const good = makePng(LOGO_SIZE, LOGO_SIZE)
  assert.match(prepareLogoUpload({ teamId: 140, treatment: 'nope', bytes: good }).problem, /no destination/)
  assert.match(prepareLogoUpload({ teamId: 234, treatment: 'alternate', bytes: good }).problem, /no destination/)
  assert.match(
    prepareLogoUpload({ teamId: 140, treatment: 'alternate', bytes: JPEG_HEADER }).problem,
    /not a PNG/,
  )
  const ok = prepareLogoUpload({ teamId: 140, treatment: 'alternate', bytes: good })
  assert.equal(ok.problem, undefined)
  assert.equal(ok.target.file, 'public/team-logos/alternate/TEX.png')
})

test('the logo route is its own thing, not a JSON store', () => {
  // The two branches of the middleware take different bodies; a key that
  // resolved to both would mean one of the two validators got skipped.
  assert.equal(devDataStore(DEV_LOGO_ROUTE), null)
  assert.ok(DEV_LOGO_MAX_BODY_BYTES > LOGO_MAX_BYTES, 'the stream guard must not undercut the art cap')
})

// --------------------------------------------------------------------------
// The copy route — reuse an already-uploaded mark on another of this team's
// treatments instead of procuring/uploading the same file again.
// --------------------------------------------------------------------------

test('a real club and two distinct real treatments resolve to a source and a target', () => {
  const copy = prepareLogoCopy({ teamId: 140, from: 'main', to: 'alternate' })
  assert.equal(copy.problem, undefined)
  assert.equal(copy.source.file, 'public/team-logos/main-overrides/TEX.png')
  assert.equal(copy.target.file, 'public/team-logos/alternate/TEX.png')
})

test('a copy refuses a bad source or target destination, same as upload does', () => {
  assert.match(prepareLogoCopy({ teamId: 140, from: 'nope', to: 'alternate' }).problem, /no destination/)
  assert.match(prepareLogoCopy({ teamId: 140, from: 'main', to: 'nope' }).problem, /no destination/)
  assert.match(prepareLogoCopy({ teamId: 234, from: 'main', to: 'alternate' }).problem, /no destination/)
})

test('a copy onto the same treatment it came from is refused rather than a silent no-op', () => {
  assert.match(prepareLogoCopy({ teamId: 140, from: 'main', to: 'main' }).problem, /same treatment/)
})

test('the copy route is its own thing too, not a JSON store or the upload route', () => {
  assert.equal(devDataStore(DEV_LOGO_COPY_ROUTE), null)
  assert.notEqual(DEV_LOGO_COPY_ROUTE, DEV_LOGO_ROUTE)
})

// --------------------------------------------------------------------------
// The coverage manifest
// --------------------------------------------------------------------------

test('the committed manifest matches the art actually on disk', async () => {
  assert.deepEqual(
    LOGO_ART,
    await buildLogoManifest(),
    'src/lib/data/logo-art.json is out of step with public/team-logos/ — run `node scripts/gen-logo-art.mjs`',
  )
})

test('every committed PNG meets the standard the endpoint enforces', () => {
  const offenders = []
  for (const [dir, files] of Object.entries(LOGO_ART)) {
    for (const [name, entry] of Object.entries(files)) {
      if (!name.endsWith('.png')) continue
      if (entry.width !== LOGO_SIZE || entry.height !== LOGO_SIZE || entry.bytes > LOGO_MAX_BYTES) {
        offenders.push(`${dir}/${name} (${entry.width}x${entry.height}, ${entry.bytes} bytes)`)
      }
    }
  }
  assert.deepEqual(offenders, [], 'committed art that a new upload of the same file would be refused')
})

test('the manifest names a real club for every file filed under an MLB abbreviation', () => {
  for (const [dir, files] of Object.entries(LOGO_ART)) {
    if (MILB_LOGO_DIRS.includes(dir)) continue // id-keyed, checked separately below
    for (const [name, entry] of Object.entries(files)) {
      const abbr = name.replace(/\.(png|svg)$/, '')
      assert.equal(entry.teamId, teamIdForAbbr(abbr), `${dir}/${name} names the wrong club`)
    }
  }
})

// Ships with zero art (PRD — MiLB has no team-id catalog to source uploads
// from yet), so this passes vacuously today; it pins the id-keyed shape for
// the first real upload rather than relying on the abbreviation test above,
// which is deliberately skipped for these two directories.
test('the manifest names the right team id for every file filed under milb-home/milb-away', () => {
  for (const dir of MILB_LOGO_DIRS) {
    for (const [name, entry] of Object.entries(LOGO_ART[dir] ?? {})) {
      assert.equal(entry.teamId, Number(name.replace(/\.(png|svg)$/, '')), `${dir}/${name} names the wrong team`)
    }
  }
})
