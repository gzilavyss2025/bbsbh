# League championship pennants

`LeaguePennant` is the shared graphic for team-season honors. It draws a flat,
vertical pennant with a team-color field, a contrasting team border, a large year, and a
one-color club mark. It has no folds, hanging hardware, perspective, shadows, or
animation. The caller selects the honors; this component only draws them.

Preview the examples at [`/design-lab?nointro#pennants`](/design-lab?nointro#pennants).

## Use

Import the named component from its own file. There is no barrel export.

```jsx
import { LeaguePennant } from '../components/honors/LeaguePennant.jsx'

<LeaguePennant
  teamId={119}
  season={2024}
  league="NL"
  teamName="Los Angeles Dodgers"
  clubLabel="LOS ANGELES"
  abbreviation="LAD"
/>
```

Select `compact` explicitly for a narrow list. Width alone does not select it.
Pass the league for that season: Milwaukee's 1982 pennant belongs to the AL.
Full art includes the club header, mark, year, and three-line league title.
Compact art keeps the mark and year.

```jsx
<LeaguePennant
  teamId={158}
  season={1982}
  league="AL"
  teamName="Milwaukee Brewers"
  clubLabel="MILWAUKEE"
  abbreviation="MIL"
  variant="compact"
  width={80}
  logoUrl={null}
/>
```

`logoUrl={null}` requests the abbreviation. To use historical art, pass a verified
one-color asset URL. Preserve the mark's negative spaces; do not whiten full-color
art with a CSS filter. See [ADR-0031](adr/0031-one-color-team-marks-are-precomputed-knockouts.md).

## Props

| Prop | Value | Purpose |
| --- | --- | --- |
| `teamId` | Team ID | Resolves club identity and the default mark. |
| `season` | Year | Prints the season and selects covered historical identity. |
| `league` | `'AL'` or `'NL'` | Required season-specific league; never inferred from today's club. |
| `teamName` | Full club name | Supplies the accessible club name. Use the name for that season. |
| `clubLabel` | Short text | Club header, such as `MILWAUKEE`. |
| `abbreviation` | Short text | Fallback when no one-color mark is available. |
| `variant` | `'full'` (default), `'compact'` | Explicit detail level. |
| `width` | Number, default `160` | Width in CSS pixels. |
| `palette` | `{ field, border, ink, year }` | Optional `#RRGGBB` overrides; omitted or invalid keys keep their defaults. |
| `logoUrl` | URL, `undefined`, or `null` | Supplied art, default identity resolution, or abbreviation only. |
| `lettering` | `'block'` (default), `'script'` | Optional Yellowtail treatment for `clubLabel`. |
| `decorative` | Boolean, default `false` | Hides the graphic from assistive technology when adjacent text repeats the honor. |
| `className` | String | Adds a class to the component root. |

The component exposes one image label, such as
`2024 Los Angeles Dodgers, National League champions`. It is not an interactive control. Keep `decorative={false}` unless
nearby accessible text already gives the complete honor. Compact art keeps the
same accessible meaning as full art.

## Change the design

- Silhouette and mark boxes: `PENNANT_ART` in `src/components/honors/pennantModel.js`. The model also resolves identity, league names, and palette defaults.
- Text positions, type sizes, and accessible markup: `src/components/honors/LeaguePennant.jsx`.
- Responsive sizing and script casing: `src/styles/honors/league-pennant.css`, imported by the component.
- Fonts: `LeaguePennant.jsx` imports `@fontsource/bungee/latin-400.css` and `@fontsource/yellowtail/latin-400.css`. Bungee draws the year; Barlow Condensed draws league text. Yellowtail is optional.

Use `palette` for a one-off theme. Each color must use six-digit hex; CSS variables
are not accepted. The model corrects `ink` and `year` to at least 4.5:1 contrast
against `field`. The border keeps its requested color. Gold is the Brewers' border;
other clubs can use orange or cream. Lab examples pass explicit approved palettes.

```jsx
<LeaguePennant teamId={158} season={1982} league="AL"
  teamName="Milwaukee Brewers" clubLabel="MILWAUKEE"
  palette={{ field: '#0A2351', border: '#FFC52F',
    ink: '#F1E7CC', year: '#FFC52F' }} />
```

## History and caller responsibility

Covered eras follow `src/lib/identity/seasonMarks.js`: use their period identity
and palette, or an abbreviation and neutral colors when period art is absent.
Uncovered seasons use current club defaults as a convenience. This is not a claim
that current art or colors match every historical season. Supply era-matched
names, labels, colors, and one-color art when exact historical identity matters.

Use “American League Champions” or “National League Champions” across eras.
The [League Championship Series began in 1969](https://www.mlb.com/postseason/history/1969).
There was [no 1994 postseason](https://www.mlb.com/postseason/history/1994), so do not
create a 1994 championship honor. Division titles and LCS appearances do not qualify.
Invalid leagues, non-integer years, years before AL 1901 or NL 1876, years above
9999, and 1994 render nothing. These input checks do not verify a winner.

The component does not fetch winner or roster data. It cannot verify a championship.
On player pages, the caller must establish the player's qualifying team-season
connection. Do not create player awards from a current roster or a matching team ID.

## Design references

[FOX6, March 2, 2026](https://www.fox6now.com/sports/brewers-look-ahead-2026-after-bitter-nlcs-exit)
shows the Brewers' pennant wall, including a 2025 division marker. It is dated visual
evidence, not verification of the October 2026 installation or a league title.
[Dugout Dirt, August 23, 2023](https://dugoutdirt.com/2023/08/23/american-family-field-home-of-the-milwaukee-brewers/)
corroborates the earlier display below the press box. Borrow its graphic language;
keep the achievement named by each pennant accurate.
