# Pitch types: one shape and one colour for each

Every pitch type has ONE mark. It looks the same on every page and for every
pitcher. The data lives in `src/lib/pitch/pitchTypes.js`. Read `pitchMark(code)`;
do not choose a colour or a shape for a pitch anywhere else.

Status: the table exists and has a test (`test/pitch-types.test.js`). No screen
uses it yet. Gary chose the rules in a design session on a dark-ground artifact
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
| FF | Four-seam | Fastball / circle | `#FF6B5E` | solid |
| SI | Sinker | Fastball / circle | `#FFA53A` | solid |
| FC | Cutter | Fastball / circle | `#B79CFF` | solid |
| SL | Slider | Breaking / diamond | `#4F8CFF` | solid |
| ST | Sweeper | Breaking / diamond | `#49C6F0` | solid |
| SV | Slurve | Breaking / diamond | `#2FD3B5` | solid |
| CU | Curveball | Breaking / diamond | `#FF7AC6` | solid |
| KC | Knuckle curve | Breaking / diamond | `#FF7AC6` | ring |
| CS | Slow curve | Breaking / diamond | `#FFB8E0` | ring |
| CH | Changeup | Offspeed / square | `#6EDC8C` | solid |
| FS | Splitter | Offspeed / square | `#C6E84A` | solid |
| FO | Forkball | Offspeed / square | `#C6E84A` | ring |
| SC | Screwball | Specialty / triangle | `#8FE3C8` | solid |
| KN | Knuckleball | Specialty / triangle | `#EEF2F7` | solid |
| EP | Eephus | Specialty / triangle | `#FFD9A8` | solid |
| UN | Other | Unlabeled / hexagon | `#8A97AD` | ring |

The family groups are the usual baseball grouping. They are not an MLB field.
Check the codes against a live feed (`pitchData`/`details.type.code`) before you
rely on one; `docs/MLB_STATS_API.md` has the feed notes.

## Open items

- **Paper ground.** The colours were tuned on a dark ground. The app's scorebook
  pages are light. Add a second tone per pitch (and run `npm run lint`'s contrast
  guard) before a screen adopts the table. Do not darken a colour in a screen.
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
