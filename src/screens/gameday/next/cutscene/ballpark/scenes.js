import { DEFENSE_ART, HOME_RUN_ART, STRIKEOUT_ART } from './assets.js'
import { DEFENSIVE_CATCH, HOME_RUN, STRIKEOUT } from './choreography.js'

// Authored scenes only. Choosing which real play earns one belongs to the
// future reveal-aware mount, never the renderer or this art catalog.
export const BALLPARK_SCENES = {
  homeRun: {
    label: 'Home run', headline: 'Home run', role: 'Batter', exampleName: 'Christian Yelich',
    character: HOME_RUN_ART, track: HOME_RUN,
    review: [0, 0.32, 0.58, 0.86, 1.48, 2.8],
  },
  strikeout: {
    label: 'Strikeout', headline: 'Strikeout', role: 'Pitcher', exampleName: 'Pitcher Name',
    character: STRIKEOUT_ART, track: STRIKEOUT,
    review: [0, 0.24, 0.44, 0.66, 1.06, 1.9],
  },
  catch: {
    label: 'Defensive catch', headline: 'What a catch', role: 'Fielder', exampleName: 'Fielder Name',
    character: DEFENSE_ART, track: DEFENSIVE_CATCH,
    review: [0, 0.4, 0.7, 1.04, 1.48, 2.8],
  },
}
