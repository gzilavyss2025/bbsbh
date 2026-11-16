# Pitch types: one shape and one colour for each

Every pitch type has ONE mark. It looks the same on every page and for every
pitcher. The data lives in `src/lib/pitch/pitchTypes.js`. Read `pitchMark(code)`;
do not choose a colour or a shape for a pitch anywhere else.

Status: the table exists and has a test (`test/pitch-types.test.js`). Two screens
use it: the new player page's Pitch arsenal module (#1892, `PitchGlyph.jsx`) and the
Now Pitching card's pitch-mix tiles (`PitchMark.jsx`). Both draw the shapes from
`src/lib/pitch/pitchGlyph.js`.
Gary chose the rules in a design session on a dark-ground artifact
(the pitcher detail page redesign, "Gasser Arsenal"). Treat the colours as a
starting point he can still tune.

## The rules

1. **Shape is the family.** Circle: fastballs. Diamond: breaking balls. Square:
   offspeed. Triangle: specialty (rare). Hexagon: unlabeled.
2. **Colour is the pitch.** One colour per MLB pitch code.
3. **Colour never works alone.** Draw the code (FF, SL, CH) beside the mark where
   there is room. Inside a family, colour is the only difference between marks.
4. **A ring is a variant.** A hollow mark is a rarer cousin of the solid mark
   beside it (KC next to CU, FO next to FS).
5. **An unknown code gets the hollow gray hexagon.** `pitchMark` never throws.
   Use this for PO (pitchout), a missing label, and MiLB feeds with no tracking.

## The table

| Code | Pitch | Family / shape | Colour | Mark |
| --- | --- | --- | --- | --- |
| FF | Four-seam | Fastball / circle | `#FA1400` | solid |
| SI | Sinker | Fastball / circle | `#BF6800` | solid |
| FC | Cutter | Fastball / circle | `#8A67E9` | solid |
| SL | Slider | Breaking / diamond | `#2E77FF` | solid |
| ST | Sweeper | Breaking / diamond | `#0F88B1` | solid |
| SV | Slurve | Breaking / diamond | `#1E8D79` | solid |
| CU | Curveball | Breaking / diamond | `#F3008B` | solid |
| KC | Knuckle curve | Breaking / diamond | `#F3008B` | ring |
| CS | Slow curve | Breaking / diamond | `#BB5F93` | ring |
| CH | Changeup | Offspeed / square | `#239141` | solid |
| FS | Splitter | Offspeed / square | `#6E8811` | solid |
| FO | Forkball | Offspeed / square | `#6E8811` | ring |
| SC | Screwball | Specialty / triangle | `#4F8977` | solid |
| KN | Knuckleball | Specialty / triangle | `#5A80B1` | solid |
| EP | Eephus | Specialty / triangle | `#9F7744` | solid |
| UN | Other | Unlabeled / hexagon | `#64738E` | ring |

The family groups are the usual baseball grouping. They are not an MLB field.
Check the codes against a live feed (`pitchData`/`details.type.code`) before you
rely on one; `docs/MLB_STATS_API.md` has the feed notes.

## Even brightness (#2974)

All 15 colours sit at the same WCAG relative luminance, so no pitch reads louder
than another, and each clears 3:1 (non-text UI) on light and dark card and inset
paper. One hex serves both themes, so the colours are mid-tones: the pastel pitches
(CS, SC, KN, EP) keep their hue at lower saturation instead of a lighter tone. `UN`
sits below the band on purpose (rule 5). `npm run lint` enforces this
(`src/lib/pitch/pitchLuminance.js`, run from `scripts/check-contrast.mjs`). Retune a
hex until it passes; do not widen the band or darken a colour in a screen.

## Open items


- **The rare marks are the least distinct** (KC, CS, FO, SC, EP). Tune them with a
  real arsenal on screen.
- The first artifact gave each of five pitches its own shape. The family rule
  replaced that, so FF, SI and FC are now all circles and differ by colour and code.

## Related: the decision point (tunneling)

The "decision point" is where the hitter must commit to swing. A common
convention puts it about 175 ms before contact (roughly 24 ft from the plate for
an average fastball). It is an analyst convention, not a Statcast field, and
sources revise the number. Compute it per pitch from release position, velocity
and acceleration; do not store it. The artifact animates each pitch type's
average path to the plate and marks this point.
