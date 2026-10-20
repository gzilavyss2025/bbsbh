// Prototype college matcher for "Where they're from" (issue #1526).
// Matches each MLB API college name (short forms like "Michigan",
// "Long Beach State", "Miami (FL)") to one IPEDS institution, so the map can
// place it in a state and county. The API gives a college state on only ~3% of
// records (291 of 9,170, measured 2026-10-20).
//
// Order of rules (first hit wins):
//   1. overrides  — hand-checked { apiName: unitid | null } (college-overrides.json)
//   2. flagship   — a bare state or short name -> its flagship (FLAGSHIP below)
//   3. expansions — CC, JC, "UC X", "Cal State X", "X State", "St." ...
//   4. exact key  — normalized IPEDS name or alias, if it names ONE school
//   5. a parenthetical hint "(FL)" / "(Ohio)" / "(CA)" narrows several hits to one
// Anything else is "unmatched" and listed for the overrides file.
//
// Usage: node match-colleges.mjs <sweep.json> <HD2023.csv> <out-dir> [overrides.json]
import fs from 'node:fs';
import path from 'node:path';

const [sweepPath, hdPath, outDir, overridesPath] = process.argv.slice(2);

// --- IPEDS HD file: a plain CSV with quoted fields -------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const [head, ...body] = parseCsv(fs.readFileSync(hdPath, 'latin1'));
const col = Object.fromEntries(head.map((h, i) => [h.replace(/^\W+/, ''), i]));
const schools = body.filter((r) => r.length > 10).map((r) => ({
  unitid: r[col.UNITID],
  name: r[col.INSTNM],
  alias: r[col.IALIAS],
  city: r[col.CITY],
  state: r[col.STABBR],
  county: r[col.COUNTYCD].padStart(5, '0'),
  cbsa: r[col.CBSA],
  lat: Number(r[col.LATITUDE]),
  lon: Number(r[col.LONGITUD]),
  level: r[col.ICLEVEL], // 1 = four-year, 2 = two-year
}));
const byId = new Map(schools.map((s) => [s.unitid, s]));

const STATE = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',PR:'Puerto Rico',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const STATE_BY_NAME = Object.fromEntries(Object.entries(STATE).map(([k, v]) => [v.toLowerCase(), k]));

// Short names MLB uses for a state's flagship (or the school the bare name
// always means in baseball). Values are exact IPEDS INSTNM strings, checked
// against HD2023. A name missing from IPEDS logs a warning, never a guess.
const FLAGSHIP = {
  'Alabama': 'The University of Alabama', 'Arizona': 'University of Arizona', 'Arkansas': 'University of Arkansas',
  'California': 'University of California-Berkeley', 'Colorado': 'University of Colorado Boulder', 'Connecticut': 'University of Connecticut',
  'Delaware': 'University of Delaware', 'Florida': 'University of Florida', 'Georgia': 'University of Georgia',
  'Hawaii': 'University of Hawaii at Manoa', 'Idaho': 'University of Idaho', 'Illinois': 'University of Illinois Urbana-Champaign',
  'Indiana': 'Indiana University-Bloomington', 'Iowa': 'University of Iowa', 'Kansas': 'University of Kansas',
  'Kentucky': 'University of Kentucky', 'Maine': 'University of Maine', 'Maryland': 'University of Maryland-College Park',
  'Massachusetts': 'University of Massachusetts-Amherst', 'Michigan': 'University of Michigan-Ann Arbor', 'Minnesota': 'University of Minnesota-Twin Cities',
  'Mississippi': 'University of Mississippi', 'Missouri': 'University of Missouri-Columbia', 'Montana': 'The University of Montana',
  'Nebraska': 'University of Nebraska-Lincoln', 'Nevada': 'University of Nevada-Reno', 'New Mexico': 'University of New Mexico-Main Campus',
  'North Carolina': 'University of North Carolina at Chapel Hill', 'Ohio': 'Ohio University-Main Campus', 'Oklahoma': 'University of Oklahoma-Norman Campus',
  'Oregon': 'University of Oregon', 'Pittsburgh': 'University of Pittsburgh-Pittsburgh Campus', 'Rhode Island': 'University of Rhode Island',
  'South Carolina': 'University of South Carolina-Columbia', 'Tennessee': 'The University of Tennessee-Knoxville', 'Texas': 'The University of Texas at Austin',
  'Utah': 'University of Utah', 'Vermont': 'University of Vermont', 'Virginia': 'University of Virginia-Main Campus',
  'Washington': 'University of Washington-Seattle Campus', 'West Virginia': 'West Virginia University', 'Wisconsin': 'University of Wisconsin-Madison',
  'Wyoming': 'University of Wyoming',
  'Southern California': 'University of Southern California', 'UCLA': 'University of California-Los Angeles', 'Louisiana State': 'Louisiana State University and Agricultural & Mechanical College',
  'LSU': 'Louisiana State University and Agricultural & Mechanical College', 'Notre Dame': 'University of Notre Dame', 'Holy Cross': 'College of the Holy Cross',
  'Boston College': 'Boston College', 'Georgetown': 'Georgetown University', 'Northwestern': 'Northwestern University',
  'Rutgers': 'Rutgers University-New Brunswick', 'San Francisco': 'University of San Francisco', 'Central Florida': 'University of Central Florida',
  'Miami (FL)': 'University of Miami', 'Miami (OH)': 'Miami University-Oxford', 'Washington State': 'Washington State University',
  'North Carolina State': 'North Carolina State University at Raleigh', 'Penn State': 'Pennsylvania State University-Main Campus', 'Ohio State': 'Ohio State University-Main Campus',
  'Long Beach State': 'California State University-Long Beach', 'Fresno State': 'California State University-Fresno', 'Cal State Fullerton': 'California State University-Fullerton',
  'Cal Poly San Luis Obispo': 'California Polytechnic State University-San Luis Obispo', "St. John's (NY)": "St. John's University-New York", "St. Mary's (CA)": "Saint Mary's College of California",
  'Arizona State': 'Arizona State University Campus Immersion', 'Kent State': 'Kent State University at Kent', 'Southern Illinois': 'Southern Illinois University-Carbondale',
  'Texas A&M': 'Texas A & M University-College Station', 'Georgia Tech': 'Georgia Institute of Technology-Main Campus', 'Virginia Tech': 'Virginia Polytechnic Institute and State University',
};

const STOP = new Set(['the', 'university', 'of', 'college', 'at', 'main', 'campus', 'and']);
const norm = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const key = (s) => norm(s).filter((w) => !STOP.has(w)).join(' ');

const byKey = new Map();
for (const s of schools) {
  for (const n of [s.name, ...s.alias.split(/[|,;]/)]) {
    const k = key(n);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(s.unitid);
  }
}
const byName = new Map(schools.map((s) => [s.name, s.unitid]));

function expansions(name) {
  const out = [name];
  let m;
  if ((m = name.match(/^UC (.+)$/))) out.push(`University of California-${m[1]}`);
  if ((m = name.match(/^Cal State (.+)$/))) out.push(`California State University-${m[1]}`);
  if ((m = name.match(/^(.+) State$/))) out.push(`${m[1]} State University`, `${m[1]} State University-Main Campus`);
  if (/ CC$/.test(name)) out.push(name.replace(/ CC$/, ' Community College'), name.replace(/ CC$/, ' College'));
  if (/ JC$/.test(name)) out.push(name.replace(/ JC$/, ' Junior College'), name.replace(/ JC$/, ' College'));
  if (/^St\. /.test(name)) out.push(name.replace(/^St\. /, 'Saint '));
  return out;
}

function hintState(name) {
  const m = name.match(/\(([^)]+)\)\s*$/);
  if (!m) return null;
  const h = m[1].trim();
  if (STATE[h.toUpperCase()]) return h.toUpperCase();
  return STATE_BY_NAME[h.toLowerCase()] || null;
}

const overrides = overridesPath && fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

function match(name) {
  if (name in overrides) return { unitid: overrides[name], rule: 'override' };
  if (FLAGSHIP[name]) {
    const id = byName.get(FLAGSHIP[name]);
    if (id) return { unitid: id, rule: 'flagship' };
    console.warn(`FLAGSHIP name not in IPEDS: ${FLAGSHIP[name]}`);
  }
  const hint = hintState(name);
  const bare = name.replace(/\s*\([^)]*\)\s*$/, '');
  for (const cand of expansions(bare)) {
    const id = byName.get(cand);
    if (id && (!hint || byId.get(id).state === hint)) return { unitid: id, rule: 'expansion' };
  }
  for (const cand of expansions(bare)) {
    const hits = [...(byKey.get(key(cand)) || [])].filter((id) => !hint || byId.get(id).state === hint);
    if (hits.length === 1) return { unitid: hits[0], rule: hint ? 'hint' : 'exact' };
    if (hits.length > 1) {
      const four = hits.filter((id) => byId.get(id).level === '1');
      if (four.length === 1) return { unitid: four[0], rule: 'four-year' };
      return { unitid: null, rule: 'ambiguous', candidates: hits.slice(0, 5) };
    }
  }
  return { unitid: null, rule: 'none' };
}

const sweep = JSON.parse(fs.readFileSync(sweepPath, 'utf8'));
const counts = new Map();
for (const p of sweep.people) {
  for (const c of p.education?.colleges || []) counts.set(c.name, (counts.get(c.name) || 0) + 1);
}
const total = [...counts.values()].reduce((a, b) => a + b, 0);
const byRule = {};
const results = [];
for (const [name, n] of counts) {
  const r = match(name);
  byRule[r.rule] = (byRule[r.rule] || 0) + n;
  results.push({ name, players: n, ...r, school: r.unitid ? byId.get(r.unitid) : null });
}
results.sort((a, b) => b.players - a.players);
fs.mkdirSync(outDir, { recursive: true });
const unmatched = results.filter((r) => !r.unitid).map((r) => ({
  name: r.name, players: r.players, rule: r.rule,
  candidates: (r.candidates || []).map((id) => `${id} ${byId.get(id).name} (${byId.get(id).state})`),
}));
fs.writeFileSync(path.join(outDir, 'unmatched.json'), JSON.stringify(unmatched, null, 1));
fs.writeFileSync(path.join(outDir, 'matched-top200.json'), JSON.stringify(results.filter((r) => r.unitid).slice(0, 200).map((r) => ({
  name: r.name, players: r.players, rule: r.rule, unitid: r.unitid, ipeds: r.school.name, state: r.school.state, county: r.school.county,
})), null, 1));
const pct = (n) => `${((100 * n) / total).toFixed(1)}%`;
console.log(`college names ${counts.size}, records ${total}`);
for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) console.log(`  ${rule.padEnd(10)} ${String(n).padStart(5)}  ${pct(n)}`);
console.log(`unmatched names ${unmatched.length} (top: ${unmatched.slice(0, 8).map((u) => `${u.name} ${u.players}`).join(', ')})`);
