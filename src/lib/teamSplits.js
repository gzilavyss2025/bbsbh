// Manual location / mascot splits for the slate cards.
//
// -------------------------------------------------------------------------
// HOW TO EDIT
// -------------------------------------------------------------------------
// Each line below is one team, written as:
//
//     Location | Mascot
//
// The "|" marks exactly where the team's full name should split. The part
// before the "|" is the small top line (MILWAUKEE); the part after is the
// big bottom line (BREWERS).
//
//   • Move the "|" to change where a name splits.
//   • For a club with no city (the Athletics), leave the left side blank and
//     start the line with "|":     | Athletics
//   • Add a new line for any team that isn't listed yet (e.g. minor-league
//     clubs) using the same "Location | Mascot" format.
//
// Any team NOT listed here falls back automatically to the split the MLB API
// suggests, so you only need to add lines where that guess looks wrong.
//
// Spelling must match the team's full name as the API writes it: the full
// name we match against is  Location + " " + Mascot.
// -------------------------------------------------------------------------

const TABLE = `
Arizona | Diamondbacks
Atlanta | Braves
Baltimore | Orioles
Boston | Red Sox
Chicago | Cubs
Chicago | White Sox
Cincinnati | Reds
Cleveland | Guardians
Colorado | Rockies
Detroit | Tigers
Houston | Astros
Kansas City | Royals
Los Angeles | Angels
Los Angeles | Dodgers
Miami | Marlins
Milwaukee | Brewers
Minnesota | Twins
New York | Mets
New York | Yankees
 | Athletics
Philadelphia | Phillies
Pittsburgh | Pirates
San Diego | Padres
San Francisco | Giants
Seattle | Mariners
St. Louis | Cardinals
Tampa Bay | Rays
Texas | Rangers
Toronto | Blue Jays
Washington | Nationals
`

function normalize(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Parse the table once into a lookup keyed by normalized full name.
const SPLITS = new Map()
for (const line of TABLE.split('\n')) {
  if (!line.trim()) continue
  const [loc = '', club = ''] = line.split('|')
  const location = loc.trim()
  const mascot = club.trim()
  if (!mascot) continue
  const fullName = location ? `${location} ${mascot}` : mascot
  SPLITS.set(normalize(fullName), { location, mascot })
}

// Returns { location, mascot } for a team's full name, or null when the team
// isn't in the table (the caller then falls back to the API's teamName).
export function lookupSplit(fullName = '') {
  return SPLITS.get(normalize(fullName)) ?? null
}
