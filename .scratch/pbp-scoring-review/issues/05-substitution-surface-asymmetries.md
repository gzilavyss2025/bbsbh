Status: fixed. A: mid-inning pinch hitter now gets a "now batting" notice
card (playbyplay.js's new `pinch_hitting` event + BatterNotice in
PlayByPlay.jsx), matching every other substitution type. B: retitled —
"Defense" → "Defensive alignment entering the Top/Bottom {ordinal}"
(EnteringReference.jsx's DefenseSection), and the lineup cards gained the
same self-contained masthead ("Lineups entering the Top/Bottom {ordinal}"),
replacing the wide-layout-only bare "Lineups" heading that the phone layout
never had at all. Researched terminology ("Defensive alignment" over the
bare "Defense", which the app also uses for the runs-allowed sense
elsewhere) before landing on the copy. Not yet browser-verified (no free
reserved dev port this session).

# Two substitution surfaces read inconsistently once a half is revealed

Both came out of the substitution audit in PR #403. Neither is a correctness
bug; both are copy/placement decisions that ADR-0017 governs, which is why they
weren't changed unilaterally.

## A. A mid-inning pinch hitter gets no notice card; a pre-pitch one does

`computeHalfInningFeed`'s `STOPPAGE_EVENTS` excludes `offensive_substitution`
except the pinch-RUNNER branch, so a pinch hitter announced mid-inning appears
only as his own at-bat card (correctly tagged `PH` via `startingPositionAbbr`).
A pinch hitter announced BEFORE a half's first pitch, by contrast, gets a
staged "now batting" `BatterNotice` from `selectPrePitchChanges`.

Defensible as-is — his at-bat card is right there and says PH, whereas the
pre-pitch card exists precisely because nothing is revealed yet. But it makes
the pinch hitter the one substitution type with no in-feed announcement, while
a defensive sub, a defensive switch, a pitching change and a pinch runner all
get one.

**Question:** card the mid-inning pinch hitter for symmetry, or keep the at-bat
card as his only mark?

Verified rendering (gamePk 823759, three mid-half pinch hitters) — Vaughn (PH),
Rumfield (PH), Sánchez (PH) each render as their own at-bat card, no notice.

## B. The defense diamond below a revealed half is titled just "Defense"

`DefenseSection` (`src/components/EnteringReference.jsx`) shows the alignment
ENTERING the half (`defenseEntering`, ADR-0010) but its heading is the bare word
"Defense". From the first at-bat step onward the whole reference moves BELOW the
play-by-play — so after a mid-inning defensive change it sits under a card
saying someone else is now playing left, claiming to be current when it isn't.

**Question:** retitle to name the moment ("Defense entering the 7th"), or leave
the bare heading? Same question applies to the lineup cards beside it, which are
also entering-state.

## Where

`src/api/playbyplay.js` (`STOPPAGE_EVENTS`), `src/api/select.js`
(`selectPrePitchChanges`), `src/components/EnteringReference.jsx`.
