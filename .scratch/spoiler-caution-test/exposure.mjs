// Method A (#2565): spoiler words in the CLAUDE.md files an agent loads.
// Usage: node .scratch/spoiler-caution-test/exposure.mjs <commit>...
// A nested CLAUDE.md loads when Claude reads a file in its folder, with its
// parents (ADR-0098). So "load set" for a path = every CLAUDE.md on its ancestry.
import { execFileSync } from 'node:child_process';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 26 });
// Typical files an open-page task reads (open) and a scoring-surface task reads (control).
const TASKS = {
  'open: player page card': 'src/screens/player/next/x.jsx',
  'open: team page': 'src/screens/team/x.jsx',
  'open: leaders page': 'src/screens/LeadersPage.jsx',
  'open: shared component': 'src/components/ui/x.jsx',
  'open: data store': 'src/lib/data/x.js',
  'control: box score': 'src/screens/boxscore/x.jsx',
  'control: lineup page': 'src/screens/lineup/next/x.jsx',
  'control: api layer': 'src/api/x.js',
};
const RE = /spoil\w*/gi;
for (const c of process.argv.slice(2)) {
  const files = git('ls-tree', '-r', '--name-only', c).split('\n').filter((f) => /(^|\/)CLAUDE\.md$/.test(f));
  const stat = {};
  for (const f of files) {
    const t = git('show', `${c}:${f}`);
    stat[f] = { hits: (t.match(RE) || []).length, lines: t.split('\n').filter((l) => /spoil/i.test(l)).length, words: t.split(/\s+/).filter(Boolean).length };
  }
  const sum = (fs) => fs.reduce((a, f) => ({ hits: a.hits + stat[f].hits, lines: a.lines + stat[f].lines, words: a.words + stat[f].words }), { hits: 0, lines: 0, words: 0 });
  const all = sum(files);
  console.log(`\n## ${c} (${git('rev-parse', '--short=9', c).trim()})`);
  console.log(`root CLAUDE.md: ${stat['CLAUDE.md'].hits} hits / ${stat['CLAUDE.md'].lines} lines / ${stat['CLAUDE.md'].words} words`);
  console.log(`all ${files.length} CLAUDE.md: ${all.hits} hits / ${all.lines} lines / ${all.words} words`);
  console.log('| task path | files loaded | spoil* hits | lines | words | hits per 1k words |\n|---|---|---|---|---|---|');
  for (const [name, p] of Object.entries(TASKS)) {
    const parts = p.split('/'); const load = [];
    for (let i = 0; i < parts.length; i++) { const f = [...parts.slice(0, i), 'CLAUDE.md'].join('/'); if (stat[f]) load.push(f); }
    const s = sum(load);
    console.log(`| ${name} | ${load.length} | ${s.hits} | ${s.lines} | ${s.words} | ${(1000 * s.hits / s.words).toFixed(1)} |`);
  }
}
