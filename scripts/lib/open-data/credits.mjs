// The two credit lines the open datasets need, written once (ADR-0100). Generators
// carry them in the data they write, and the About page prints them.
//
// Retrosheet asks that this statement appear prominently, word for word. Do not
// reword it. Chadwick Bureau register: Open Data Commons Attribution License 1.0.
export const RETROSHEET_CREDIT =
  'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at 20 Sunset Rd., Newark, DE 19711.'

export const CHADWICK_JOIN =
  'Player ids matched through the Chadwick Bureau register (Open Data Commons Attribution License 1.0).'

// GeoNames places the birthplaces on the map (ADR-0106). Creative Commons
// Attribution 4.0: a credit and the licence name.
export const GEONAMES_CREDIT = 'Birthplace locations from GeoNames (geonames.org), licensed under CC BY 4.0.'

// "Where they're from" (#1526): the school locations and the metro areas behind its map. Both
// sources are US government works and ask for no exact wording. The About page and the /from
// foot print them; src/lib/from/copy.js repeats them for the app, and test/from-lib.test.js
// pins the two copies against each other.
export const IPEDS_CREDIT = 'College locations from the U.S. Department of Education, National Center for Education Statistics, IPEDS.'
export const CENSUS_CREDIT = 'Metro areas and populations from the U.S. Census Bureau.'
