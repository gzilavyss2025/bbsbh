# The trade story (Trade Simulator)

The news story under a built trade: `src/screens/trade/story/build.js` (pure),
loaded by `TradeStory.jsx`. Tests: `test/trade-story.test.js`. The first plan is
`docs/trade-story-plan.html`.

## Rules

- **Templates, not a model.** Every sentence is filled from data the page already
  has. No API call, no cost, no invented fact. A sentence whose facts are missing
  returns null and drops out.
- **Say each fact once.** A season's awards share one year ("won a Silver Slugger
  and a Gold Glove in 2026"); a rank or value the lede gave is not repeated below.
- **Voice:** a beat writer's wire copy. Plain verbs, numbers as the wire prints
  them, "postseason", no hype.

## The angle

`pickAngle` picks what the lede hangs on, first match wins, and returns a
`reason` (on `story.angle`) for tests and debugging:

| Angle | When | Lede ends |
|---|---|---|
| `award` | the headline player has a major award (MVP, Cy Young, ROY, WS MVP, Reliever of the Year) | ", the 2026 NL Cy Young winner," |
| `prospects` | the taker gives up a top-100 prospect | "that costs them X, MLB Pipeline's No. N prospect." |
| `fit` | the player takes a starting spot the taker had under 1.0 WAR or empty (`lib/trade/lineup.js`) | "that fills their hole in left field." |
| `restock` | the giver missed the postseason and gets org-ranked prospects back | "that restocks the Brewers with prospects." |
| `value` | surplus value tilts $50M+ one way (`verdictOf` big/steal) | "that tilts well toward the Brewers by surplus value." |
| `season` | none of the above | the taker's season leads ("Coming off a 77-85 season…") |

The headline follows the angle too: `fit` "Cardinals fill left-field hole with
Jackson Chourio in four-player deal with Brewers", `prospects` "Diamondbacks send
top prospect X to Brewers for Y", `restock` "Brewers trade X to Diamondbacks for
prospects". The others keep "A trade X to B in N-player deal".

## Known gaps

- Award data starts in 2022: an older MVP is invisible.
- Contender status is one season's record plus the postseason result.
- Only 40-man pitchers carry a role, so a minor-league reliever can still start
  in the lineup the `fit` angle reads.

## Adding an angle

Add a test with a small example trade first (watch it fail), then a branch in
`pickAngle` and its lede ending, then a row in the table above. Add the trade to
`EXAMPLES` in the test file.
