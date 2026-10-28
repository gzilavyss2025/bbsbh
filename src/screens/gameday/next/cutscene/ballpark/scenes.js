import { DEFENSE_ART } from './assets.js'
import { DEFENSIVE_CATCH } from './choreography.js'
import { FIST_PUMP, CONFETTI_WIN, VICTORY_HOP, HOME_RUN_SALUTE, PITCHER_PUMP } from './variants.js'

// Authored scenes only. Choosing which real play earns one belongs to the
// future reveal-aware mount, never the renderer or this art catalog.
export const BALLPARK_SCENES = {
  homeRun: {
    label: 'Home run salute', headline: 'Home run', role: 'Batter', exampleName: 'Christian Yelich',
    ...HOME_RUN_SALUTE,
    review: [0, 0.22, 0.44, 0.7, 1.02, 2.8],
  },
  grandSlam: {
    label: 'Confetti win · grand slam', headline: 'Grand slam', role: 'Batter', exampleName: 'Batter Name',
    ...CONFETTI_WIN,
    review: [0, 0.28, 0.5, 0.76, 1.2, 3.6],
  },
  // Any RBI that is not a homer; celebrationForPlay names the play in its own headline.
  rbi: {
    label: 'Fist pump · RBI', headline: 'RBI', role: 'Batter', exampleName: 'Batter Name',
    ...FIST_PUMP,
    review: [0, 0.24, 0.44, 0.64, 0.94, 2.4],
  },
  multiRbi: {
    label: 'Victory hop · multiple RBI', headline: 'RBI', role: 'Batter', exampleName: 'Batter Name',
    ...VICTORY_HOP,
    review: [0, 0.22, 0.4, 0.58, 0.86, 2.8],
  },
  strikeout: {
    label: 'Strikeout · pitcher pump', headline: 'Strikeout', role: 'Pitcher', exampleName: 'Pitcher Name',
    ...PITCHER_PUMP,
    review: [0, 0.18, 0.34, 0.48, 0.72, 1.9],
  },
  catch: {
    label: 'Defensive catch', headline: 'What a catch', role: 'Fielder', exampleName: 'Fielder Name',
    character: DEFENSE_ART, track: DEFENSIVE_CATCH,
    review: [0, 0.4, 0.7, 1.04, 1.48, 2.8],
  },
}
