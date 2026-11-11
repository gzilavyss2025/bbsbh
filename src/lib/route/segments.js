// The pieces every address with an id or a hint is spelled from: the
// '{slug}-{id}' segment (ADR-0057) and the `?d=`/`?s=` query. They live here,
// under lib/route/, so the pattern entries (patterns.js) and lib/route.js can
// both use them without an import cycle. lib/route.js re-exports all of them,
// so their importers did not change.

import { teamFullName } from '../teams.js'
import { isYearView } from '../dates.js'

// --- Addresses that carry a name -------------------------------------------
//
// A page about a PERSON or a CLUB is addressed by their name AND their MLB id:
// '/player/mike-trout-545361', '/team/milwaukee-brewers-158/roster'. The id
// resolves the page; the slug in front of it is for the reader, the search
// engine, and whoever pastes the link into a message.
//
// READING IS LOOSE, WRITING IS STRICT. parseRoute takes the trailing digits and
// ignores everything in front of them, so '/player/545361' — every link shared
// before this existed — resolves unchanged, with no redirect, forever. Builders
// emit the slug whenever the caller hands them a name, the bare id when not.
// Because BOTH forms resolve, rel=canonical decides which one a search engine
// counts; api/preview.js writes it at the slugged form and keeps its own copy of
// these helpers, since the edge runtime can't import this module graph. Change
// one, change both. ADR-0057 has the why the id stays.

// Longest slug we will put in front of an id: long enough for any real club or
// person ('rocket-city-trash-pandas' is 24), short enough that a MiLB club with
// a sponsor in its name can't run away with the address bar.
const SLUG_MAX = 48

// A name -> a URL-safe slug. Diacritics are FOLDED, not dropped: 'José Ramírez'
// has to become 'jose-ramirez', because stripping the marks without decomposing
// first gives 'jos-ram-rez', which no reader would match to the plain spelling.
export function slugify(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
}

// The id inside a '{slug}-{id}' segment, and the whole segment when there is no
// slug on it. The id is always the LAST hyphen-separated group, so a name that
// itself ends in a number cannot be mistaken for one. Anything matching neither
// shape is handed back untouched, so a mangled URL still fails where it used to
// — at the fetch — rather than somewhere new.
export function idFromSlug(segment) {
  const s = String(segment ?? '')
  if (/^\d+$/.test(s)) return s
  const m = s.match(/-(\d+)$/)
  return m ? m[1] : s
}

// The counterpart every path builder goes through. No name, or an id that
// is not a plain number (an undefined off a half-loaded row): emit the bare id
// and let the address stay short rather than mint 'undefined-158'.
export function entitySegment(id, name) {
  const slug = /^\d+$/.test(String(id ?? '')) ? slugify(name) : ''
  return slug ? `${slug}-${id}` : String(id ?? '')
}

// Clubs get their name for free. All 30 MLB clubs are already named in a static
// table (teams.js MLB_TEAM_NAMES), so every '/team/...' address slugs itself
// whether or not the caller had a name to hand — which is most of the team hub,
// where a tab button knows an id and a tab key and nothing else. A MiLB club is
// not in that table: only its own feed knows its name, so those callers pass it,
// and an affiliate whose feed hasn't landed yet keeps the bare-id address it has
// always had (the MiLB degrade in root CLAUDE.md).
//
// The static table WINS over a passed name, which is the opposite of everywhere
// else here and is the point: a club is called several things on this site — the
// standings say "Rays", the off-day tile says "D-backs", the hub says "Tampa Bay
// Rays" — and a link picks up whichever one it happens to be rendering. One club
// must have ONE address, so for the 30 the table knows, the table decides. Only
// a club it does not know takes the caller's word.
export function teamSegment(id, name) {
  return entitySegment(id, teamFullName(Number(id)) || name)
}

// Build a player / team page path. `d` = the as-of date (YYYY-MM-DD), `s` =
// sportId. Both optional, and both absent on an ordinary link — including one
// out of a game, which is the change ADR-0034's amendment records. A path
// carrying `d` is one the reader asked for, and every link built from that page
// keeps it so a single visit gives a single answer.
// Exported so the as-of date control (`components/seal/AsOfBanner.jsx`) can
// apply a picked date to whatever page it's rendering on by re-appending this
// query to `location.pathname` — the same query string every path builder
// below already produces, so a hand-built one can't drift from theirs.
export function linkQuery({ d, s } = {}) {
  const q = new URLSearchParams()
  // A past season's last day is the address `?y=2018` (#2588), the way parseRoute reads it back.
  if (d) isYearView(d) ? q.set('y', d.slice(0, 4)) : q.set('d', d)
  if (s) q.set('s', String(s))
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}
