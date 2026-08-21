// Pure, spoiler-aware shaping of the /people responses into the view model the
// player & team pages render. No fetching here (that's mlb.js) — every function
// takes raw API pieces and returns display-ready data, degrading to null/'—'
// for the fields MiLB feeds omit, per the app's "degrade, don't assume" rule.
//
// Spoiler note: these builders NEVER touch the live game feed. The player page
// fetches its own stats cut off at the day before the game date ("entering
// today"), so nothing here can leak the game being scored. The full-season
// figures that can't be date-cut by the API — the current-season register row,
// the vs-L/R splits, and the promoted other-level tiles (see
// otherLevelSeasonBlocks) — are labeled as such by the UI, not frozen; each is
// a stat at a level OTHER than the game being scored, never that game's own line.
//
// Split (ADR-0038, check-file-size.mjs) into src/api/person/ — one module per
// concern, catalogued in that directory. This file is a thin re-export so no
// caller needs to change: see src/api/person/*.js for the actual code.

export {
  personSportId,
  isPitcher,
  isTwoWay,
  pitcherRole,
  draftInfo,
  splitDisplayName,
  personBio,
  rosterStatusView,
  lastPlayedSeason,
} from './person/identity.js'

export {
  aggregateSplits,
  hitterTiles,
  pitcherTiles,
  splitsView,
  SITUATIONAL_SIT_CODES,
  situationalSplitsView,
  pitchingRanksView,
  hittingRanksView,
} from './person/stats.js'

export {
  gameLogView,
  FIRSTS_DEFS,
  PITCHER_FIRSTS_DEFS,
  firstsFromGameLog,
  firstMilestoneSeasons,
} from './person/gameLog.js'

export {
  MILESTONE_DEFS,
  MILESTONE_PROGRESS_FLOOR,
  nearestMilestone,
  milestoneWatchView,
  projectMilestoneETA,
  careerPerSeasonRate,
  MILESTONE_RARITY,
  milestoneRarityRank,
  mlbCareerThroughCutoff,
} from './person/milestones.js'

export {
  arsenalView,
  advancedPitchingView,
  advancedHittingView,
  battedBallView,
} from './person/advanced.js'

export {
  levelSeasonStat,
  careerRegisterView,
  positionPlayerPastNote,
  levelProgressionView,
  dropRehabStints,
  careerTimelineView,
} from './person/careerRegister.js'

export {
  tradeKey,
  signedFallback,
  transactionTimelineView,
} from './person/transactions.js'

export {
  MAJOR_AWARDS,
  DEFAULT_AWARD_ORDER,
  awardLeague,
  awardsView,
  rankAwards,
  rankKeyOf,
  parseAwardOrder,
  formatAwardOrder,
  parseAwardCap,
  knownRankKeys,
} from './person/awards.js'

export {
  detectRehabAssignment,
  detectInjuredList,
  injuredListStints,
  otherLevelSeasonBlocks,
  buildBlock,
} from './person/activity.js'

export {
  fieldingView,
  starterRelieverView,
  starterRelieverCareer,
  pitchingStints,
} from './person/positionInnings.js'

export {
  ordinal,
  rankTeam,
  rosterPitcherRole,
  firstLast,
  POS_ORDER,
} from './person/teamPage.js'
