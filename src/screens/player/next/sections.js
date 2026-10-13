// The new player page's sections and slots (#1884): which buttons the jump bar
// lists, which module fills each slot, and which buttons the loaded state hides.
// Pure. The page maps over this and never changes for a module; the contract is
// in ./CLAUDE.md. `key` is the section element's id.
const BATTER = [
  ['overview', 'Overview'],
  ['season', 'Season'],
  ['splits', 'Splits'],
  ['plate-approach', 'Plate approach'],
  ['contact', 'Contact'],
  ['form-trend', 'Form trend'],
  ['game-log', 'Game log'],
  ['career', 'Career'],
  ['history', 'History'],
]
const PITCHER = [
  ['overview', 'Overview'],
  ['season', 'Season'],
  ['pitches', 'Pitches'],
  ['splits', 'Splits'],
  ['on-the-mound', 'On the mound'],
  ['form-trend', 'Form trend'],
  ['game-log', 'Game log'],
  ['career', 'Career'],
  ['history', 'History'],
]
// A two-way player has the batter bar, then the two sections only a pitcher has.
const PITCHER_ONLY = PITCHER.filter(([key]) => !BATTER.some(([k]) => k === key))

const H = ['hitting']
const P = ['pitching']
const HP = ['hitting', 'pitching']

// One entry per module folder (modules/<module>/index.jsx), in page order within a
// section. A section holds several slots. `roles` are the stat groups the module
// serves; a player with both gets one instance per role. `load` is a static
// import, so a module's code arrives only when its slot comes near.
export const SLOTS = [
  { id: 'season', module: 'season', section: 'season', label: 'Season', roles: HP, load: () => import('./modules/season/index.jsx') },
  { id: 'tbd-season', module: 'tbd', section: 'season', label: 'More season', roles: HP, load: () => import('./modules/tbd/index.jsx') },
  { id: 'splits', module: 'splits', section: 'splits', label: 'Splits', roles: HP, load: () => import('./modules/splits/index.jsx') },
  { id: 'plate', module: 'plate', section: 'plate-approach', label: 'Plate approach', roles: H, load: () => import('./modules/plate/index.jsx') },
  { id: 'contact', module: 'contact', section: 'contact', label: 'Contact', roles: H, load: () => import('./modules/contact/index.jsx') },
  { id: 'form', module: 'form', section: 'form-trend', label: 'Form trend', roles: H, load: () => import('./modules/form/index.jsx') },
  { id: 'pform', module: 'pform', section: 'form-trend', label: 'Form trend', roles: P, load: () => import('./modules/pform/index.jsx') },
  { id: 'batlog', module: 'batlog', section: 'game-log', label: 'Game log', roles: H, load: () => import('./modules/batlog/index.jsx') },
  { id: 'pitchlog', module: 'pitchlog', section: 'game-log', label: 'Game log', roles: P, load: () => import('./modules/pitchlog/index.jsx') },
  // Foul balls has no button on the boards: it sits in the Game log section, and similar players ends it (the tbd slot after it is the "more" board).
  { id: 'fouls', module: 'fouls', section: 'game-log', label: 'Foul balls', roles: H, load: () => import('./modules/fouls/index.jsx') },
  { id: 'similar', module: 'similar', section: 'game-log', label: 'Similar players', roles: HP, load: () => import('./modules/similar/index.jsx') },
  { id: 'tbd-gamelog', module: 'tbd', section: 'game-log', label: 'More game log', roles: HP, load: () => import('./modules/tbd/index.jsx') },
  { id: 'arsenal', module: 'arsenal', section: 'pitches', label: 'Pitch arsenal', roles: P, load: () => import('./modules/arsenal/index.jsx') },
  { id: 'mound', module: 'mound', section: 'on-the-mound', label: 'On the mound', roles: P, load: () => import('./modules/mound/index.jsx') },
  { id: 'tbd-mound', module: 'tbd', section: 'on-the-mound', label: 'More on the mound', roles: P, load: () => import('./modules/tbd/index.jsx') },
  { id: 'path', module: 'path', section: 'career', label: 'Path to the Majors', roles: HP, load: () => import('./modules/path/index.jsx') },
  { id: 'prospects', module: 'prospects', section: 'career', label: 'Prospect rankings', roles: HP, load: () => import('./modules/prospects/index.jsx') },
  { id: 'tbd-career', module: 'tbd', section: 'career', label: 'More career', roles: HP, load: () => import('./modules/tbd/index.jsx') },
  { id: 'firsts', module: 'firsts', section: 'history', label: 'Firsts', roles: HP, load: () => import('./modules/firsts/index.jsx') },
  { id: 'innings', module: 'innings', section: 'history', label: 'Innings by position', roles: HP, load: () => import('./modules/innings/index.jsx') },
  { id: 'contract', module: 'contract', section: 'history', label: 'Contract', roles: HP, load: () => import('./modules/contract/index.jsx') },
  { id: 'tbd-history', module: 'tbd', section: 'history', label: 'More history', roles: HP, load: () => import('./modules/tbd/index.jsx') },
]

const WORD = { hitting: 'Batting', pitching: 'Pitching' }

// The stat groups a player has: from the loaded blocks, else from the bio.
export function rolesOf(bio, blocks) {
  const batter = blocks.some((b) => b.group === 'hitting')
  const pitcher = blocks.some((b) => b.group === 'pitching') || (!batter && bio.isPitcher)
  return batter && pitcher ? ['hitting', 'pitching'] : pitcher ? ['pitching'] : ['hitting']
}

// The jump-bar buttons, in order. A count shows only when the loaded data gives one: the
// Game log's is the season's game total (the larger of a two-way player's two, since the
// games overlap). A button hides by its slots (shownSections), never here.
// `blocks` are api/player/overview.js's stat blocks.
export function jumpSections(bio, blocks) {
  const roles = rolesOf(bio, blocks)
  const list = roles.length > 1 ? [...BATTER, ...PITCHER_ONLY] : roles[0] === 'pitching' ? PITCHER : BATTER
  const games = Math.max(0, ...blocks.map((b) => b.seasonGames || 0))
  return list.map(([key, label]) => ({ key, label, count: key === 'game-log' && games ? games : undefined }))
}

// The slots for a player: one per slot per role it serves that he has. A both-role
// slot on a two-way player says which role in its name tab.
export function slotInstances(roles) {
  return SLOTS.flatMap((s) => {
    const mine = s.roles.filter((r) => roles.includes(r))
    return mine.map((role) => ({
      ...s,
      role,
      key: `${s.id}:${role}`,
      label: s.roles.length > 1 && roles.length > 1 ? `${s.label} · ${WORD[role]}` : s.label,
    }))
  })
}

// The buttons to show. `empty` maps an instance key to true once its module has
// said it has no data. A button hides only when ALL its slots are empty; a section
// with no slot (Overview) always shows.
export function shownSections(sections, instances, empty) {
  return sections.filter((s) => {
    const mine = instances.filter((i) => i.section === s.key)
    return !mine.length || mine.some((i) => !empty[i.key])
  })
}

// Slots the loaded data already shows empty: with no games the game log and the foul-ball
// slots have nothing, while the section keeps its other slots (Similar players). The log
// lists postseason games too, so a call-up with only October games keeps his log. Each log
// module reads its own role's block. Same shape as `empty`: key -> true.
const LOG_MODULES = new Set(['batlog', 'fouls', 'pitchlog'])
export function seedEmpty(instances, blocks) {
  const out = {}
  for (const i of instances) {
    if (!LOG_MODULES.has(i.module)) continue
    const b = blocks.find((x) => x.group === i.role)
    if (!b?.seasonGames && !b?.postseason?.games) out[i.key] = true
  }
  return out
}
