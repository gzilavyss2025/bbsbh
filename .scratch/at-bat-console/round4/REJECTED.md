Status: REJECTED by Gary, 2026-10-07. Kept as an example of what not to do.

# Round 4 (#1389): why it was rejected

Labels: **[Gary]** = Gary's words, quoted exactly or relayed by the parent session.
**[shape session]** = my words, from my own screenshots in `mockups/`.

## Gary's reasons

- **[Gary]** "didn't really change the design of the page, didn't make it fit to one
  screen, just kinda plopped stuff"
- **[Gary]** The layout is wrong at some widths.
- **[Gary]** Too crowded: too many blocks at once.

## The three directions

Page heights are from `tools/shoot.mjs` (full page, px). The phone screen is 763 px
tall; the iPad landscape screen is 820 px; the desktop screen is 900 px.

**D1, The box**
- What it did **[shape session]**: put the scorecard's #22 box at ×2.2 beside the play
  sentence. Then it stacked the scene, the pitch list and the zone plot under it.
- How it fails **[shape session]**: the revealed phone page is 1738 to 2170 px tall
  (2.3 to 2.8 screens). At 1180 and 1440 it is today's page with one more card: the
  same band, the same rail, the same running line. The pitch list's column is narrow,
  so "Four-Seam Fastball" breaks onto two lines.

**D2, The log**
- What it did **[shape session]**: put one row per pitch with a "pencil" column, the
  steal card between the pitches, then the result row, and "The box, filled" at the foot.
- How it fails **[shape session]**: the revealed phone page is 1696 to 2162 px tall.
  The result row and "The box, filled" show the same ladder, code and diamond twice on
  one screen. At 1180 it is again today's page shape with a longer card. At 1440 the
  trail becomes a narrow left column and the stage gets narrower, not wider.

**D3, The field**
- What it did **[shape session]**: put the pitch scene beside the park flight, then a key
  card with a 150 px diamond, then the pitch list and zone. It folded the reference rail
  to chips at every width.
- How it fails **[shape session]**: it is the tallest at every width. The revealed
  pages are 1672 to 2076 px on the phone, 1510 to 1861 px at 820 to 1440. That is about
  two screens even on the desktop. On a strikeout the park is hidden, so the stage
  changes shape from one at-bat to the next. The wide pages leave large empty margins
  beside a centred scene.

**All three [shape session]:** each one kept every block and stacked them in a new
order. Nothing was removed from view, merged or put one tap away. So the page did not
change its design. It only got longer.

## Lessons for the next attempt

a. **[shape session, from Gary's "too crowded" and "just kinda plopped stuff"]** "Keep
   all 99 blocks" must not mean "show all 99 blocks". The next brief must rank every
   block in the inventory into three tiers:
   - always shown,
   - one tap away,
   - only when it happens.

   Then it must redesign the page around that ranking. It must not reorder the
   current stack.

b. **[Gary]** The design must fit one screen and adapt to the screen size. Gary asked
   for both. **[shape session]** For the next brief, that means: the main state (one
   revealed at-bat) fits one screen on the phone (390 × 763) with no scroll. iPad and
   desktop use their extra room for a different layout, not for the same stack with
   wider margins.

`inventory.md` is still valid: it is the input to that ranking.
