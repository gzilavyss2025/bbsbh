// Prototype map-geometry build for "Where they're from" (issue #1526).
// Hand-run, immutable data: Census boundaries and metro areas change only
// when Census republishes, so this is NOT a nightly job.
//
// Inputs (paths as arguments, never downloaded here — ADR-0100):
//   1. us-atlas@3.0.1 counties-albers-10m.json (2017 Census cartographic
//      counties, pre-projected with geoAlbersUsa to a 975x610 viewport)
//   2. us-atlas@3.0.1 counties-10m.json (same counties, unprojected; used only
//      for each county's latitude/longitude centroid)
//   3. ../data/metro-zones-2023.csv (one row per county in a qualifying metro)
//
// Output: one JSON { viewBox, states: { GA: { d, b }, ... },
//   zones: { GA: [ { id, name, kind, d, counties: [fips...] } ] },
//   countyZone: { "13121": "GA-atlanta", ... } }
//
// Zone rule (decided 2026-10-20, see SPEC.md "Zones"):
//   - Metro zones: rows of metro-zones-2023.csv (Metropolitan Statistical
//     Areas whose IN-STATE population is >= 500,000, at most 6 per state,
//     largest first; Connecticut has none, see SPEC).
//   - Every other county of the state goes to a compass zone. Split the rest by
//     county-centroid terciles along the state's longer axis
//     (taller -> Northern/Central/Southern, wider -> Western/Central/Eastern).
//     9+ rest counties -> 3 zones, 4-8 -> 2 zones (Northern/Southern or Western/Eastern),
//     1-3 -> one zone "Rest of {State}".
//
// Usage: node gen-map.mjs <counties-albers-10m.json> <counties-10m.json> <metro-zones.csv> <out.json>
import fs from 'node:fs';
import * as topo from 'topojson-client';
import * as simp from 'topojson-simplify';
import { geoPath, geoCentroid } from 'd3-geo';

const [albersPath, geoPathIn, metroCsv, outPath] = process.argv.slice(2);
const FIPS = {'01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'};
const NAME = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let albers = JSON.parse(fs.readFileSync(albersPath, 'utf8'));
albers = simp.simplify(simp.presimplify(albers), 0.5);
const geo = JSON.parse(fs.readFileSync(geoPathIn, 'utf8'));
const centroid = {};
for (const f of topo.feature(geo, geo.objects.counties).features) centroid[f.id] = geoCentroid(f);

const metroOf = {};
for (const line of fs.readFileSync(metroCsv, 'utf8').trim().split(/\r?\n/).slice(1)) {
  const m = line.match(/^(\d+),(\d+),(\d+),"?(.*?)"?,([^,]+),(\d+)$/);
  if (!m) throw new Error(`bad metro row: ${line}`);
  metroOf[m[2]] = m[5];
}

const path = geoPath().digits(1);
const counties = albers.objects.counties.geometries;
const byState = {};
for (const g of counties) {
  const st = FIPS[g.id.slice(0, 2)];
  if (st) (byState[st] ||= []).push(g);
}

const out = { viewBox: [975, 610], states: {}, zones: {}, countyZone: {} };
for (const st of Object.keys(NAME)) {
  const gs = byState[st] || [];
  if (!gs.length) continue;
  const stateGeom = topo.merge(albers, gs);
  out.states[st] = { d: path(stateGeom), b: path.bounds(stateGeom).flat().map((v) => Math.round(v)) };

  const groups = new Map();
  const rest = [];
  for (const g of gs) {
    const z = metroOf[g.id];
    if (z) { if (!groups.has(z)) groups.set(z, []); groups.get(z).push(g); }
    else rest.push(g);
  }
  const zones = [...groups].map(([name, list]) => ({ name, kind: 'metro', list }));

  if (rest.length) {
    const [x0, y0, x1, y1] = out.states[st].b;
    const tall = (y1 - y0) > (x1 - x0);
    const axis = (g) => (tall ? -centroid[g.id][1] : centroid[g.id][0]); // north first / west first
    const sorted = [...rest].sort((a, b) => axis(a) - axis(b));
    const parts = sorted.length >= 9 ? 3 : sorted.length >= 4 ? 2 : 1;
    const labels = parts === 3 ? (tall ? ['Northern', 'Central', 'Southern'] : ['Western', 'Central', 'Eastern'])
      : parts === 2 ? (tall ? ['Northern', 'Southern'] : ['Western', 'Eastern']) : [null];
    for (let i = 0; i < parts; i++) {
      const list = sorted.slice(Math.round((i * sorted.length) / parts), Math.round(((i + 1) * sorted.length) / parts));
      zones.push({ name: labels[i] ? `${labels[i]} ${NAME[st]}` : `Rest of ${NAME[st]}`, kind: 'compass', list });
    }
  }
  out.zones[st] = zones.map((z) => {
    const id = `${st}-${slug(z.name.replace(/ metro$/, ''))}`;
    for (const g of z.list) out.countyZone[g.id] = id;
    return { id, name: z.name, kind: z.kind, d: path(topo.merge(albers, z.list)), counties: z.list.map((g) => g.id).sort() };
  });
}

fs.writeFileSync(outPath, JSON.stringify(out));
const zoneCount = Object.values(out.zones).reduce((n, z) => n + z.length, 0);
console.log(`states ${Object.keys(out.states).length}, zones ${zoneCount}, counties ${Object.keys(out.countyZone).length}, bytes ${fs.statSync(outPath).size}`);
