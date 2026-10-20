// Prototype of the weekly "Where they're from" sweep (issue #1526).
// NOT a generator yet: it writes to the path given as argv[2] and is the
// measured basis for docs in ../SPEC.md. The real one becomes
// scripts/gen-where-from.mjs and follows scripts/CLAUDE.md.
//
// Step 1: one request per season lists every MLB player id that season.
//         (/sports/1/players ignores hydrate=education, measured 2026-10-20.)
// Step 2: /people?personIds=<200 ids>&hydrate=education returns birthplace,
//         debut, position and schools for 200 players per request.
//
// Usage: node .scratch/where-theyre-from/prototype/sweep.mjs <out.json> [firstSeason] [lastSeason]
import fs from 'node:fs';
import { getJson } from '../../../scripts/lib/statsapi.mjs';

const out = process.argv[2];
const first = Number(process.argv[3] || 1876);
const last = Number(process.argv[4] || new Date().getUTCFullYear());
const BATCH = 200;
const CONCURRENCY = 4;

async function pool(items, fn) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

const seasons = [];
for (let y = first; y <= last; y++) seasons.push(y);
let requests = 0;
const ids = new Set();
await pool(seasons, async (y) => {
  const d = await getJson(`/api/v1/sports/1/players?season=${y}&fields=people,id`);
  requests++;
  for (const p of d.people || []) ids.add(p.id);
});

const all = [...ids];
const batches = [];
for (let i = 0; i < all.length; i += BATCH) batches.push(all.slice(i, i + BATCH));
const FIELDS = 'people,id,fullName,mlbDebutDate,primaryPosition,abbreviation,birthCity,birthStateProvince,birthCountry,education,highschools,colleges,name,city,state';
const people = [];
await pool(batches, async (b) => {
  const d = await getJson(`/api/v1/people?personIds=${b.join(',')}&hydrate=education&fields=${FIELDS}`);
  requests++;
  people.push(...(d.people || []));
});

fs.writeFileSync(out, JSON.stringify({ sweptAt: new Date().toISOString(), seasons: [first, last], requests, people }));
console.log(`seasons ${first}-${last}: ${all.length} players, ${people.length} returned, ${requests} requests`);
