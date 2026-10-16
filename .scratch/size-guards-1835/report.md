# Size guards: research report for #1835 (main at af15e122, 2026-10-16)

No code changed. **Measured** = counted in the files. **Inferred** = my estimate.

## Numbers

| | `check-dir-size.mjs` | `check-file-size.mjs` |
|---|---|---|
| Whole file | 1,167 lines | 407 lines |
| `BUDGETS` table | lines 51-1084 (1,033 lines) | lines 71-325 (254 lines) |
| Table entries | 12 | 41 |
| Comment lines in table | 1,020 | 212 |
| Header + checking code | about 134 | about 153 |
| "N -> M" changelog lines | 87 | 38 |

The tables hold about 1,290 lines. About 1,230 are comments.

## Q1. Do the history comments earn their keep?

Mostly no. The "N -> M for X" lines are a changelog, and `git log` keeps that. The lines worth keeping say why a directory is an exception:

- `api/`: a file is a URL, so it stays flat.
- `src/styles`: the partials are an ordered cascade, so nesting breaks them.
- `scripts`: the `gen-*.mjs` generators stay flat.

Those are about 5 to 15 lines per entry. The `scripts` entry also has a 1,162-character inline comment on one line.

Inferred: trimming to the "why" only leaves about 100 lines in the dir table and about 60 in the file table. That removes about 1,100 lines and changes no number.

Side effect (inferred): `check-dir-size.mjs` would drop under 600 lines, so its own entry in the file guard (budget 1200) could go too.

## Q2. Would JSON help?

Barely. JSON has no comments, so the "why" would become string fields. The bulk either moves or gets trimmed anyway, and trimming is the saving.

The worry about `scripts/lib` is not real. `SOURCE_EXT` (line 45 of `check-dir-size.mjs`) is `.js .jsx .mjs .css`, so a `.json` file is not counted.

A JSON file does separate data from logic, but both guards rewrite budgets by hand with the number in the failure message. No tool edits the file, so there is no gain.

## Q3. Is there duplicated logic?

No. Both already share `scripts/lib/walk.mjs` (51 lines). Their loops differ on purpose (ADR-0038):

- the dir guard is an exact ratchet;
- the file guard is a ceiling in 100-line bands.

A merged guard needs both modes, which is more code.

A merge also means editing about 31 non-`src` files that name the guards. Those include `CLAUDE.md`, `scripts/CLAUDE.md`, `docs/testing.md`, `docs/motion.md`, `docs/design-system-naming.md`, ADRs 0035, 0038, 0041, 0082 and 0085, and other guard scripts. Another 48 `src/` files mention them in comments.

## Options for Gary

1. **Trim the table comments (recommended).** Keep the "why" per entry, drop the changelog. About -1,100 lines. No behaviour change.
2. **Move tables to JSON.** Little gain; see Q2.
3. **Merge the guards.** No saving; large doc churn.
4. **Decline.**

Any change ships as its own PR. It changes no budget number, and the PR is rebased onto `main` and re-measured first.
