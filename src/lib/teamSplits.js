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
//   • A line that starts with "#" is a heading/comment and is ignored.
//   • Add a new line for any team that isn't listed yet using the same
//     "Location | Mascot" format.
//
// Any team NOT listed here falls back automatically to the split the MLB API
// suggests, so you only need to fix lines where the "|" is in the wrong spot.
//
// Spelling must match the team's full name as the API writes it: the full
// name we match against is  Location + " " + Mascot.
//
// The minor-league lines below were generated from the MLB Stats API, so the
// "|" is already placed at the API's own split. Adjust any you'd prefer split
// differently (e.g. multi-word mascots).
// -------------------------------------------------------------------------

const TABLE = `
# --- MLB ---
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
It's Just | Athletics
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

# --- AAA ---
Albuquerque | Isotopes
Buffalo | Bisons
Charlotte | Knights
Columbus | Clippers
Durham | Bulls
El Paso | Chihuahuas
Gwinnett | Stripers
Indianapolis | Indians
Iowa | Cubs
Jacksonville | Jumbo Shrimp
Las Vegas | Aviators
Lehigh Valley | IronPigs
Louisville | Bats
Memphis | Redbirds
Nashville | Sounds
Norfolk | Tides
Oklahoma City | Comets
Omaha | Storm Chasers
Reno | Aces
Rochester | Red Wings
Round Rock | Express
Sacramento | River Cats
Salt Lake | Bees
Scranton/Wilkes-Barre | RailRiders
St. Paul | Saints
Sugar Land | Space Cowboys
Syracuse | Mets
Tacoma | Rainiers
Toledo | Mud Hens
Worcester | Red Sox

# --- AA ---
Akron | RubberDucks
Altoona | Curve
Amarillo | Sod Poodles
Arkansas | Travelers
Biloxi | Shuckers
Binghamton | Rumble Ponies
Birmingham | Barons
Chattanooga | Lookouts
Chesapeake | Baysox
Columbus | Clingstones
Corpus Christi | Hooks
Erie | SeaWolves
Frisco | RoughRiders
Harrisburg | Senators
Hartford | Yard Goats
Knoxville | Smokies
Midland | RockHounds
Montgomery | Biscuits
New Hampshire | Fisher Cats
Northwest Arkansas | Naturals
Pensacola | Blue Wahoos
Portland | Sea Dogs
Reading | Fightin Phils
Richmond | Flying Squirrels
Rocket City | Trash Pandas
San Antonio | Missions
Somerset | Patriots
Springfield | Cardinals
Tulsa | Drillers
Wichita | Wind Surge

# --- A+ ---
Asheville | Tourists
Beloit | Sky Carp
Bowling Green | Hot Rods
Brooklyn | Cyclones
Cedar Rapids | Kernels
Dayton | Dragons
Eugene | Emeralds
Everett | AquaSox
Fort Wayne | TinCaps
Frederick | Keys
Great Lakes | Loons
Greensboro | Grasshoppers
Greenville | Drive
Hillsboro | Hops
Hub City | Spartanburgers
Hudson Valley | Renegades
Jersey Shore | BlueClaws
Lake County | Captains
Lansing | Lugnuts
Peoria | Chiefs
Quad Cities | River Bandits
Rome | Emperors
South Bend | Cubs
Spokane | Indians
Tri-City | Dust Devils
Vancouver | Canadians
West Michigan | Whitecaps
Wilmington | Blue Rocks
Winston-Salem | Dash
Wisconsin | Timber Rattlers

# --- A ---
Augusta | GreenJackets
Bradenton | Marauders
Charleston | RiverDogs
Clearwater | Threshers
Columbia | Fireflies
Daytona | Tortugas
Delmarva | Shorebirds
Dunedin | Blue Jays
Fayetteville | Woodpeckers
Fort Myers | Mighty Mussels
Fredericksburg | Nationals
Fresno | Grizzlies
Hickory | Crawdads
Hill City | Howlers
Inland Empire | 66ers
Jupiter | Hammerheads
Kannapolis | Cannon Ballers
Lake Elsinore | Storm
Lakeland | Flying Tigers
Myrtle Beach | Pelicans
Ontario | Tower Buzzers
Palm Beach | Cardinals
Rancho Cucamonga | Quakes
Salem | RidgeYaks
San Jose | Giants
St. Lucie | Mets
Stockton | Ports
Tampa | Tarpons
Visalia | Rawhide
Wilson | Warbirds
`

function normalize(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Parse the table once. Each row becomes { location, mascot }.
const rows = []
for (const raw of TABLE.split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue // blank or heading
  const [loc = '', club = ''] = line.split('|')
  const location = loc.trim()
  const mascot = club.trim()
  if (!mascot) continue
  rows.push({ location, mascot })
}

// Primary lookup: the reconstructed full name (Location + " " + Mascot) matched
// against the API's team.name — e.g. "Milwaukee Brewers".
const SPLITS = new Map()
for (const { location, mascot } of rows) {
  const fullName = location ? `${location} ${mascot}` : mascot
  SPLITS.set(normalize(fullName), { location, mascot })
}

// Fallback lookup: the mascot alone, but only for mascots that are unique in
// the table (so "Cubs"/"Cardinals"/"Mets" etc. stay disambiguated by full
// name). This is what lets a row set a display location the API name doesn't
// contain — e.g. "It's Just | Athletics", where team.name is just "Athletics".
const mascotCounts = new Map()
for (const { mascot } of rows) {
  const k = normalize(mascot)
  mascotCounts.set(k, (mascotCounts.get(k) ?? 0) + 1)
}
for (const { location, mascot } of rows) {
  const k = normalize(mascot)
  if (mascotCounts.get(k) === 1 && !SPLITS.has(k)) {
    SPLITS.set(k, { location, mascot })
  }
}

// Returns { location, mascot } for a team's full name, or null when the team
// isn't in the table (the caller then falls back to the API's teamName).
export function lookupSplit(fullName = '') {
  return SPLITS.get(normalize(fullName)) ?? null
}
