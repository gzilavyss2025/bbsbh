# Console-game HUD notes for Gameday (#2568)

Source images: `research/sources.md` (all YouTube stills, 1280x720). Claude looked at 12 of the 26.
[Seen] = in the image. [Inference] = Claude's reading for Gameday.

## Patterns seen

1. **Full-bleed field, HUD at the edges.** [Seen] MVP 03/04/05, Show 09–16: the batting view fills the
   screen; info floats in the corners and along the top. Nothing sits in a side panel.
2. **Scorebug.** [Seen] MVP 04: two rows (runs box, club, inning arrow on the batting row) plus "0-0-1"
   (balls-strikes-outs) at the right. Show 09–12: one full-width strip "TB 3 | BOS 1 | ▼1ST | 1-2 | 2 OUT".
   Show 16: a compact top-left block with logos, score, base diamond, out dots, "PITCHES 31", inning, count.
3. **Runner diamond hangs off the scorebug.** [Seen] MVP 03/04/05: a diamond inset under the bug shows a
   live picture of each runner on base. Show 09/11: a picture-in-picture runner view top left / top right.
4. **Pitch tag at the zone.** [Seen] MVP 03/04: "81 MPH / SLIDER" above four corner brackets.
   Show 10: a small "90 mph CUT" tag beside the pitch-location crosshair, with a "K" badge.
5. **The zone is light.** [Seen] Corner brackets (MVP) or a thin outline (Show). Hot/cold as a
   translucent 3x3 overlay (MVP 05) or a red wash (Show 16).
6. **Lower-third cards.** [Seen] "Now batting": logo, #, name, position, one row of season stats,
   headshot box at the right (MVP 04, Show 09). Pitcher: a vertical card at the right ("STARTING PITCHER"
   season table, MVP 04; "LAST START" table, Show 12).
7. **Contact result panel.** [Seen] Show 16, bottom right: "Swing timing: Good / Contact result: Line
   drive, Hit speed 107 mph / 4SFB 97 mph" and a mini zone with the pitch dot.
8. **Between halves.** [Seen] Show 07: full screen line score (1–9, R H E) and "DUE UP" with three
   stacked bars (slot, position, name, #, headshot) and today's line ("1 FOR 1 / 1B"). Show 09/16:
   a small "MID 1ST" R H E box in a corner over a cutaway shot.
9. **Defensive alignment.** [Seen] Show 10: overhead field with headshot + name tags at each position.
10. **Fielding mini-map.** [Seen] Show 15: a small diamond top right with the ball as a red dot,
    during the overhead fielding camera. Show 15 post-contact: high wide shot from behind home.
11. **Final score.** [Seen] MVP 05: two club panels with the score, SV, the two pitchers' lines side by
    side with WP / LP, a "Box score" tab, and an "Advance" prompt bottom right.

## What Gameday can borrow [Inference]

- Layout direction A, "HUD over the stage": the stage fills the screen; the bug, the runner diamond,
  the pitch tag, a lower-third and the advance control float at the edges. Fits no-scroll by design.
- The never-fold game state = one scorebug with the base diamond inside it (MVP + Show 16).
- "Who is up" = a lower-third strip; after the play it turns into the result strip (code + RBI).
- The decision pitch's tag (speed, type, call) sits beside its dot on the zone (Show 10).
- Contact panel (Show 16) = exit velocity, launch angle, distance, trajectory, after the reveal.
- Checkpoint page 4 = Show 07's line score + due up with today's lines (#2606 day lines).
- End of game = MVP 05's final card, then the box score.
- Menu item "Field" = Show 10's defensive alignment with name tags.
- The chase camera ends on an overhead field with a corner mini-map (Show 15).
- Not borrowed: the other-scores ticker (Show 12) — other games' scores are not this page's job.
