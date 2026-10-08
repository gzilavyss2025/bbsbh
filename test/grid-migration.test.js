// Grid migration slice G2 (#1180): auto-fit and auto-fill rules moved onto <Grid>.
// The shared checker (test/helpers/layoutMigration.js) pins the stylesheet, the
// <Grid> sites (min, fit, gap) and the cascade. A rule deleted whole has no class
// left, so `dropped` finds its site by `min`.
import test from 'node:test'
import { checkMigration } from './helpers/layoutMigration.js'

const GRID = {
  component: 'Grid',
  sheet: 'system/grid.css',
  props: ['gap', 'min', 'fit'],
  defaults: { gap: 'snug', fit: false },
  closed: true,
}

const MIGRATED = {
  idlab__erafields: { file: '17a-identity-lab-mark-panels.css', min: '7rem', fit: true, keeps: ['min-width'] },
  gamesgrid__grid: { file: '', dropped: true, jsx: 'screens/team/modules/TeamGames.jsx', min: '{100}' },
}

test('every migrated grid is a <Grid> with the old min, mode and gap, and its rule is gone', () => {
  checkMigration(GRID, MIGRATED)
})
