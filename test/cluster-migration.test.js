// Cluster migration slices C1 to C7 (#1180): twenty-four wrapping-row rules moved onto
// <Cluster>. Each would fail silently otherwise (lint green, page drawn, only a
// screenshot noticing):
//
//   1. THE RULE IS GONE. A migrated class keeps no display, flex, wrap or gap
//      of its own, in any rule that ends in it. If one came back, it would load after system/cluster.css and
//      win on order, so the gap step would stop meaning what Cluster says.
//   2. THE SITES. Every JSX site that names the class is a <Cluster> with the
//      step the old rule had (snug is the default and is left out).
//   3. THE CASCADE. No migrated partial is imported by index.css ahead of
//      system/cluster.css, so it could not lose to it. A migrated partial is
//      lazy (a component imports it) or sits after the cluster in index.css.
import { defineMigrationTests } from './helpers/layoutMigration.js'

const CLUSTER = {
  component: 'Cluster',
  sheet: 'system/cluster.css',
  props: ['gap', 'align'],
  defaults: { gap: 'snug' },
  closed: true,
}

// class -> its stylesheet, the gap step and align the old rule used, the JSX sites,
// and the declarations the rule keeps (the part does not own them). A site with no
// align stretches, the flexbox default.
const MIGRATED = {
  cwb__tabs: { file: '74-contract-workbench.css', gap: 'snug', sites: 1 },
  'standings-jumps': { file: '30-standings.css', gap: 'tight', sites: 3 },
  coverpick__colors: { file: '60-book-cover-picker.css', gap: 'base', sites: 1 },
  bpadmin__row: { file: '61-ballpark-admin.css', gap: 'snug', sites: 1 },
  lookupdeck__filters: { file: '74a-contract-lookup.css', gap: 'base', sites: 1 },
  idlab__barsrow: { file: '17-identity-lab-workbench.css', gap: 'base', sites: 1 },
  idlab__wpaartrow: { file: '17-identity-lab-workbench.css', gap: 'snug', sites: 1 },
  bookmgmt__actions: { file: '58-logbook-shelf.css', gap: 'base', sites: 3, keeps: ['align-items: center'] },
  // C2: the offseason cards. Each keeps its own margin-top.
  pgame__actions: { file: '78-offseason.css', gap: 'base', sites: 1, keeps: ['margin-top'] },
  seasonnote__leagues: { file: '78-offseason.css', gap: 'snug', sites: 1, keeps: ['margin-top'] },
  srecord__doors: { file: '78-offseason.css', gap: 'base', sites: 1, keeps: ['margin-top'] },
  idlab__recolorpalette: { file: '17-identity-lab-workbench.css', gap: 'snug', sites: 1, align: 'center', keeps: ['margin-top'] },
  idlab__monoinkparts: { file: '17-identity-lab-workbench.css', gap: 'snug', sites: 2, keeps: ['margin'] },
  // C4: the rule is gone whole; the row is a baseline-aligned Cluster.
  idlab__umpire: { file: '17-identity-lab-workbench.css', gap: 'snug', sites: 1, align: 'baseline' },
  // C5: the Game Log chip rows. Each keeps its own margin-bottom.
  logbook__seasons: { file: '48-logbook.css', gap: 'snug', sites: 1, keeps: ['margin-bottom'] },
  logbookstats__levels: { file: '48a-logbook-stats.css', gap: 'snug', sites: 1, keeps: ['margin-bottom'] },
  // C6: four rows, one file each. Each keeps its own margin-top, if it had one.
  stampsheet__levels: { file: '48c-stamp-sheet.css', gap: 'snug', sites: 1 },
  mytally__choices: { file: '54-my-tally.css', gap: 'snug', sites: 1, keeps: ['margin-top'] },
  consent__actions: { file: '46-consent-modal.css', gap: 'snug', sites: 1, keeps: ['margin-top'] },
  staffgrid__summary: { file: '76-workload-marks.css', gap: 'snug', sites: 1, align: 'center' },
  // C7: four rows, five JSX sites in five files. The erase sheet keeps its own margin-top.
  pshistory__seasonhead: { file: '33-awards-history.css', gap: 'base', sites: 1, align: 'center' },
  psseries__potgWho: { file: '35-postseason-series.css', gap: 'snug', sites: 1, align: 'baseline' },
  erasesheet__actions: { file: '55-my-tally-account.css', gap: 'snug', sites: 1, keeps: ['margin-top'] },
  'team-hub__namerow': { file: '28a-team-hub-hero.css', gap: 'snug', sites: 2, align: 'baseline' },
}

defineMigrationTests('cluster', CLUSTER, MIGRATED)
