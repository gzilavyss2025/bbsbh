// The Matchup Scout's head-to-head labels (#1410): the short round tag and the
// scorebook shorthand for a plate appearance's result. Labels, never prose.

// Savant `game_type` to the list's round tag.
export const ROUND_TAG = { R: 'REG', F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }

// Scorebook shorthand for a Savant `events` value (plus bb_type for an out).
const SHORT = {
  strikeout: 'K', walk: 'BB', intent_walk: 'IBB', hit_by_pitch: 'HBP', single: '1B',
  double: '2B', triple: '3B', home_run: 'HR', sac_fly: 'SF', field_error: 'E',
  grounded_into_double_play: 'DP',
}
const OUT = { ground_ball: 'GO', fly_ball: 'FO', line_drive: 'LO', popup: 'PO' }
export const resultShort = ({ event, bbType }) => SHORT[event] ?? OUT[bbType] ?? 'Out'
