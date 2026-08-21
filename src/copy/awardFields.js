// The Award weight group's three registry fields, split out of registry.js the
// same way the eleven guides' slots are (landing/fields.js): that file is at
// its 600-line budget, and a group whose fields are hand-written rather than
// derived from a table still has to live somewhere. Imported and spread back
// into FIELDS in registry.js, which stays the one place a field is DEFINED.

import { DEFAULT_AWARD_ORDER, formatAwardOrder } from '../api/person/awards.js'

// A table cap: one digit, 1–9. Zero would hide the section from a player who
// has awards, which is the one setting this control must not be able to make.
const AWARD_CAP = /^[1-9]$/

export function awardFields() {
  return [
  // ---- Award weight. NOT copy: this group is the one ORDERING in the app that
  // the owner sets, plus the two numbers that say how much of it gets a table.
  // It rides the registry because the registry is already the thing that
  // stores a bounded, allowlisted, versioned value the owner edits without a
  // deploy — building a second store for one ordered list would be a parallel
  // path, not an improvement (see ADR-0063). The panel renders `awards.order`
  // with a reorder list rather than a raw textarea (GROUPS' `editor` flag),
  // but the stored value stays a plain newline-separated string, so the box is
  // still readable and repairable by hand if that UI ever breaks.
  //
  // SPOILER FOOTING, unchanged. An award is a season-level career fact on a
  // page deliberately outside the scoring flow (ADR-0034); none of these three
  // values is derived from game data, and none is rendered inside a sealed
  // surface. The guard at the top of this file still holds.
  {
    id: 'awards.order',
    group: 'awards',
    label: 'Weight order',
    help: 'One award per line, most consequential first. A player’s page leads with the ones highest in this list that he actually won; everything else moves into the index behind “Show all”. An award missing from this list sorts last, never first. Leave empty to use the shipped order.',
    maxLength: 4000,
    multiline: true,
    default: formatAwardOrder(DEFAULT_AWARD_ORDER),
  },
  {
    id: 'awards.capDesktop',
    group: 'awards',
    label: 'Tables per player — desktop',
    help: 'How many awards get their own Year / Team / League table on a wide screen. 1–9. Everything past this number still appears, as one line each, in the index below.',
    maxLength: 1,
    multiline: false,
    pattern: AWARD_CAP,
    default: '6',
  },
  {
    id: 'awards.capPhone',
    group: 'awards',
    label: 'Tables per player — phone',
    help: 'The same number for a phone, where a nine-row table costs most of the screen. 1–9, and never more than the desktop number — a bigger phone cap is ignored.',
    maxLength: 1,
    multiline: false,
    pattern: AWARD_CAP,
    default: '3',
  },
  ]
}
