# All-Star Rosters shows final scores — a narrow, explicit spoiler-rule exception

The spoiler rule (root `CLAUDE.md`) is otherwise absolute: a score-revealing
value must never exist in the DOM until the user reveals it, with no age
exemption — a 1955 game got no special treatment versus one from last week.
The All-Star Rosters page carves out one deliberate exception to that: it
shows each year's final score plainly, in a small full-width result card, with
no `SealBox` and no tap-to-reveal.

This is safe specifically here because the page's subject — who was NAMED to
a squad — already carries no individual game's stakes (same footing as Awards
History, League Leaders, and WAR, none of which sit behind a seal either), and
because an All-Star Game is exhibition: nobody is scoring it as *their* game
the way the live slate's spoiler rule is built to protect. The result is
decades-settled trivia layered onto a roster list, not a spoiler for a game
the app's own user is following.

The final score comes from `scripts/gen-all-star-rosters.mjs`, which already
fetches each season's schedule row to resolve `gamePk` — that same row carries
`teams.{away,home}.score` for a completed game, read by the ASG's fixed AL/NL
pseudo-team ids (159/160, not real clubs) rather than by side, and stored as
`scores[season] = { al, nl }`. No live per-render score fetch is added; the
value is baked into the same static, hand-run JSON as everything else on this
page.

This exception does not extend anywhere else. Every other game surface in the
app — including the box score reachable from this same page — still renders
through the ordinary `SealBox`/reveal-only path. If a future surface wants to
show a score outside a seal, it needs its own ADR justifying why that surface's
subject, like this one, carries no individual game's stakes — it should not be
read as opening the invariant generally (see also ADR-0015 for Game Score's
narrower, opt-in exception on the live slate).
