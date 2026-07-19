import { useCallback, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamFullName, teamColorSwatches } from '../lib/teams.js'

// Neutral options every club's mark gets compared against too, alongside its
// own brand colors — not a "brand color" so it lives here, not in
// teamColorSwatches.
const NEUTRAL_SWATCHES = [
  { label: 'Black', hex: '#000000' },
  { label: 'White', hex: '#FFFFFF' },
]

// This session's working picks — one swatch label per team, going into the
// eventual GameCard background decision. Seeded from the first pass through
// the lab; a click on any swatch below overrides its team's entry, and every
// change is persisted (see PICKS_KEY) so it survives a reload.
const DEFAULT_PICKS = {
  109: 'Secondary', // Diamondbacks
  111: 'Secondary', // Red Sox
  133: 'Secondary', // Athletics
  134: 'Primary', // Pirates
  135: 'Secondary', // Padres
  136: 'Secondary', // Mariners
  137: 'Secondary', // Giants
  141: 'Primary', // Blue Jays
  145: 'Secondary', // White Sox
  158: 'Powder Blue', // Brewers
}

// Claude's suggestion for every team with no pick yet — chosen by checking
// each swatch against its logo for a self-matching-color problem (e.g. the
// Athletics' and Royals' primary is nearly the same hue as their own logo
// ink, so the mark nearly disappears; see the "Secondary" picks below).
// Only rendered for a team that has no entry in `picks` — a real pick always
// wins over a suggestion.
const RECOMMENDED_PICKS = {
  108: 'Primary', // Angels — navy gives the red "A" strong contrast
  110: 'Secondary', // Orioles — the orange bird pops hardest on black
  112: 'Primary', // Cubs — classic Cubbie blue, logo reads clean
  113: 'Secondary', // Reds — black beats red-on-red for the wishbone C
  114: 'Primary', // Guardians — navy avoids the red-on-red block C
  115: 'Secondary', // Rockies — silver avoids the purple-on-purple monogram
  116: 'Secondary', // Tigers — orange avoids the navy-on-navy Old English D
  117: 'Primary', // Astros — navy, the classic star-and-H look
  118: 'Secondary', // Royals — gold avoids the navy-on-navy KC monogram
  119: 'Secondary', // Dodgers — red avoids the blue-on-blue script LA
  120: 'Secondary', // Nationals — navy avoids the red-on-red curly W
  121: 'Secondary', // Mets — orange avoids the navy-on-navy interlocking NY
  138: 'Secondary', // Cardinals — navy avoids the red-on-red birds-on-bat
  139: 'Secondary', // Rays — light blue avoids the navy-on-navy TB
  140: 'Secondary', // Rangers — red avoids the navy-on-navy T
  142: 'Kasota Gold', // Twins — their own iconic road-cap tan
  143: 'Secondary', // Phillies — blue avoids the red-on-red script P
  144: 'Secondary', // Braves — navy avoids the red-on-red script A
  146: 'Slate Gray', // Marlins — avoids both the primary's washed contrast and black eating the fish's own black body
  147: 'Gray', // Yankees — their own uniform gray, classic road-jersey look
}

// Clubs whose mark is a wide wordmark/script reaching close to its own
// viewBox edges (LA, KC, TB, interlocking NY, TC, the Astros' star-H) — the
// standard frame's edge-bleed scale (.colorlab__logobox .teamlogo, scale
// 1.32) clips those edges, unlike the more centered/circular marks it was
// tuned for. These get a gentler scale instead (.colorlab__logobox--loose).
const LOOSE_FIT_TEAM_IDS = new Set([
  117, // Astros
  118, // Royals
  119, // Dodgers
  121, // Mets
  139, // Rays
  142, // Twins
])

// A distinct alternate/secondary mark per team, tiled against the same color
// swatches as the primary logo above — sourced from Wikimedia Commons (free-
// licensed) or MLB's own CDN, never a Wikipedia "non-free" file. Coverage is
// partial: about a third of the league has no genuinely distinct mark hosted
// under an acceptable license (no forced substitutes — see teams.js's own
// "no alternate mark on this CDN" note). Quality is intentionally mixed here
// — some are clean transparent vector marks, others are mascot photos or
// carry their own baked-in background (so the swatch tint behind them won't
// show through) — this is a reference/comparison row, not curated art.
const ALT_LOGOS = {
  108: { url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Los_Angeles_Angels_logo_%281961-1965%29.svg', label: '1961–65 “LA” monogram' }, // Angels
  110: { url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/The_Oriole_Bird_2014.jpg', label: 'Oriole Bird mascot' }, // Orioles
  111: { url: 'https://upload.wikimedia.org/wikipedia/commons/5/50/BostonRedSox1908logo.svg', label: '1908 sock mark' }, // Red Sox
  112: { url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/1920_cub_logo.svg', label: '1920s bear-in-C' }, // Cubs
  113: { url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Mr_Red.jpg', label: 'Mr. Red mascot' }, // Reds
  114: { url: 'https://img.mlbstatic.com/mlb-images/image/private/t_16x9/t_w640/mlb/o22mez2nvlprbymkhwbk.jpg', label: 'Winged G on baseball' }, // Guardians
  118: { url: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Kansas_City_Royals_Insignia.svg', label: '“KC” monogram (not the crown — no free-licensed crown-only mark found)' }, // Royals
  134: { url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Pittsburgh_Pirates_Alternate_logo.png', label: 'Jolly Roger pirate head' }, // Pirates
  144: { url: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Atlanta_Braves_Insignia.svg', label: 'Cap “A” monogram (not the tomahawk — no free-licensed tomahawk-only mark found)' }, // Braves
  145: { url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/White_Sox_Alt_Logo.svg', label: 'Sock-on-diamond mark' }, // White Sox
}

// Each club's MOST RECENT City Connect (Nike's alternate-identity uniform
// program) art, tiled against the same swatches — pure private pre-approval
// reference for scoping a licensing request, per the user's explicit ask.
// UNLIKE ALT_LOGOS above, these are deliberately sourced from wherever the
// clearest recent art could be found (team/retailer product photos, Nike's
// own newsroom, sportslogos.net) with NO free-license requirement — none of
// this is cleared for any use beyond that private reference. Researched
// 2026-07-17; several clubs are already on their second City Connect design
// (checked and only the newest is listed). The Athletics and Yankees have
// never released one (both confirmed, omitted rather than guessed); the Cubs
// exited the program in 2025 after their 2021 design, noted below.
const CITY_CONNECT = {
  108: { url: 'https://images.squarespace-cdn.com/content/v1/5ab4527b3c3a536a7a352c05/1654537661655-0UIJ6OASMKA8NIYANQG3/FUlchbcXEAEJNmA.jpeg', label: '2022 (only design)' }, // Angels
  109: { url: 'https://img.mlbstatic.com/mlb-images/image/upload/t_16x9/t_w1024/mlb/vgqxpbbyujuh5t4ve1h5.jpg', label: '2025 “Serpientes” (2nd design)' }, // Diamondbacks
  110: { url: 'https://img.mlbstatic.com/mlb-images/image/upload/mlb/fqxccsbye58cnqcrm5zd.jpg', label: '2026 “2.0” (2nd design)' }, // Orioles
  111: { url: 'https://www.19jerseystreet.com/cdn/shop/files/H1949.jpg?v=1747420317&width=1946', label: '2025 “Fenway Greens” (only design)' }, // Red Sox
  112: { url: 'https://www.wrigleyvillesports.com/cdn/shop/files/100773_300x.jpg?v=1762473416', label: '2021 “Wrigleyville” (exited the program in 2025 — no longer active)' }, // Cubs
  113: { url: 'https://www.thebiglead.com/wp-content/uploads/2026/04/mens-new-era-red-cincinnati-reds-2026-city-connect-59fifty-fitted-hat_ss5_p-203427877pv-1u-ulhj3usgatmtgfootsl5v-7crhpprtuimjmiqicjgk.avif', label: '2026 “2.0” (2nd design)' }, // Reds
  114: { url: 'https://www.colorwaysports.com/images/posts/guardians-uniform-schedule-2026/guardians-city-connect.jpg', label: '2024 (only design)' }, // Guardians
  115: { url: 'https://www.westword.com/wp-content/uploads/sites/2/ww-media/mediaserver/den/2025-16/rockies_city_connect_cap.webp', label: '2025 “2.0” (2nd design)' }, // Rockies
  116: { url: 'https://wdet.org/wp-content/uploads/2024/05/TigersCityConnectJerseys-1024x576.jpg', label: '2024 “Motor City” (only design)' }, // Tigers
  117: { url: 'https://www.neweracap.com/cdn/shop/files/60667268_NE0204010_MLB25_CITY_20CONNECT_HOUASTCC25_WHT_F.jpg', label: '2025 “2.0” (2nd design)' }, // Astros
  118: { url: 'https://nmp.about.nike.com/about/prod/d75fe621-84a8-4622-bc36-3585e5e3ba68/nike-2026-mlb-city-connect-kansas-city-royals-1.jpg?m=eyJlZGl0cyI6eyJqcGVnIjp7InF1YWxpdHkiOjEwMH0sIndlYnAiOnsicXVhbGl0eSI6MTAwfSwiZXh0cmFjdCI6eyJsZWZ0IjowLCJ0b3AiOjAsIndpZHRoIjoyMTM0LCJoZWlnaHQiOjMyMDB9LCJyZXNpemUiOnsid2lkdGgiOjc1MH19fQ%3D%3D&s=b8b012c01789cd437fe650fd6234f316c87b25e423547e6b6666a41836d483c6', label: '2026 “Forever Fountains” (2nd design)' }, // Royals
  119: { url: 'https://content.sportslogos.net/logos/54/63/full/los-angeles-dodgers-alternate-logo-2024-6337832024.png', label: '2024 “City of Dreamers” (2nd design)' }, // Dodgers
  120: { url: 'https://content.sportslogos.net/logos/54/578/full/washington-nationals-cap-2025-57878882025.png', label: '2025 “District Blueprint” (2nd design)' }, // Nationals
  121: { url: 'https://content.sportslogos.net/logos/54/67/full/new_york_mets_logo_cap_2024sportslogosnet8625.png', label: '2024 (only design)' }, // Mets
  134: { url: 'https://nmp.about.nike.com/about/prod/d75fe621-84a8-4622-bc36-3585e5e3ba68/nike-2026-mlb-city-connect-pittsburgh-pirates-1.jpg?m=eyJlZGl0cyI6eyJqcGVnIjp7InF1YWxpdHkiOjEwMH0sIndlYnAiOnsicXVhbGl0eSI6MTAwfSwiZXh0cmFjdCI6eyJsZWZ0IjowLCJ0b3AiOjAsIndpZHRoIjoyMTM0LCJoZWlnaHQiOjMyMDB9LCJyZXNpemUiOnsid2lkdGgiOjc1MH19fQ%3D%3D&s=c479bcc0345a32e6e7039961a320f025311a98f19b489daadcd4e256ca9a1826', label: '2026 (2nd design)' }, // Pirates
  135: { url: 'https://nmp.about.nike.com/about/prod/d75fe621-84a8-4622-bc36-3585e5e3ba68/nike-2026-mlb-city-connect-san-diego-padres-1.jpg?m=eyJlZGl0cyI6eyJqcGVnIjp7InF1YWxpdHkiOjEwMH0sIndlYnAiOnsicXVhbGl0eSI6MTAwfSwiZXh0cmFjdCI6eyJsZWZ0IjowLCJ0b3AiOjAsIndpZHRoIjoyMTM0LCJoZWlnaHQiOjMyMDB9LCJyZXNpemUiOnsid2lkdGgiOjc1MH19fQ%3D%3D&s=16a753c01d531156640793bef6b21e05119b25d47ee4744d99b86797d3d57269', label: '2026 “Día de los Muertos” (2nd design)' }, // Padres
  136: { url: 'https://content.sportslogos.net/logos/53/75/full/seattle_mariners_logo_cap_2023_sportslogosnet-6776.png', label: '2023 (only design)' }, // Mariners
  137: { url: 'https://content.sportslogos.net/news/2025/04/sf-giants-city-connect-cap-black-tie-dye-SF-sportslogosnet-2025-102618f.jpg', label: '2025 (2nd design)' }, // Giants
  138: { url: 'https://content.sportslogos.net/news/2024/05/st-louis-cardinals-city-connect-the-lou-logo-sportslogosnet-082621.jpg', label: '2024 “The Lou” (only design)' }, // Cardinals
  139: { url: 'https://www.neweracap.com/cdn/shop/files/60503049_59FIFTY_CITYCNCTTAMRAYOF_TAMRAYCC24_OTC_F.jpg?v=1714404554', label: '2024 (only design)' }, // Rays
  140: { url: 'https://www.neweracap.com/cdn/shop/files/60867642_59FIFTY_CITOTCNNECTTEXRAN_TEXRAN_OTC_F.jpg?v=1775742384', label: '2026 “Tejas” (2nd design)' }, // Rangers
  141: { url: 'https://www.neweracap.com/cdn/shop/files/60867644_59FIFTY_CITYCNCTTORJAYOF_TORJAY_OTC_F.jpg?v=1775749506', label: '2024 “Night Mode” (only design)' }, // Blue Jays
  142: { url: 'https://www.neweracap.com/cdn/shop/files/60503050_59FIFTY_CITYCNCTMINTWIOF_MINTWICC24_OTC_F.jpg?v=1718026661', label: '2024 “Ripple Effect” (only design)' }, // Twins
  143: { url: 'https://www.neweracap.com/cdn/shop/files/60503051_59FIFTY_CITYCNCTPHIPHIOF_PHIPHICC24_OTC_3QL.jpg?v=1712321695', label: '2024 (only design)' }, // Phillies
  144: { url: 'https://www.neweracap.com/cdn/shop/files/60867635_59FIFTY_CITOTCNNECTATLBRA_ATLBRA_OTC_3QL.jpg?v=1775742353', label: '2026 (2nd design)' }, // Braves
  145: { url: 'https://www.neweracap.com/cdn/shop/files/60666567_59FIFTY_CITYCONNECTCHIWHI_CHIWHI_OTC_3QL.jpg?v=1745870654', label: '2025 “BRED” (2nd design)' }, // White Sox
  146: { url: 'https://www.neweracap.com/cdn/shop/files/60666571_59FIFTY_CITYCONNECTMIAMAR_MIAMAR_OTC_F.jpg?v=1746190436', label: '2025 “Retrowave” (2nd design)' }, // Marlins
  158: { url: 'https://img.mlbstatic.com/mlb-images/image/upload/mlb/grpwcal2fqq1gpufyidv.jpg', label: '2026 “Wisco” (2nd design)' }, // Brewers
}

const PICKS_KEY = 'bbsbh:colorlab:picks'

function readStoredPicks() {
  try {
    const raw = window.localStorage.getItem(PICKS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_PICKS
  } catch {
    return DEFAULT_PICKS
  }
}

// Dev harness for picking a background tint behind the slate card's logo tile
// (.gamecard__logobox) — every club's mark repeated once per known brand
// color (primary/secondary + accent, deduped; see teamColorSwatches) plus
// black and white, so the options can be compared side by side instead of one
// at a time in CSS. Tap a swatch to mark it as the pick for that team (tap
// again to clear it). Reached at /team-color-lab, linked from nowhere.
export function TeamColorLab() {
  useDocumentTitle('Team Color Lab')
  const teams = [...ALL_MLB_TEAM_IDS].sort((a, b) =>
    teamFullName(a).localeCompare(teamFullName(b)),
  )
  const [picks, setPicks] = useState(readStoredPicks)

  const togglePick = useCallback((teamId, label) => {
    setPicks((prev) => {
      const next = { ...prev }
      if (next[teamId] === label) delete next[teamId]
      else next[teamId] = label
      try {
        window.localStorage.setItem(PICKS_KEY, JSON.stringify(next))
      } catch {
        // Private-mode / storage-disabled — degrade to in-session memory only.
      }
      return next
    })
  }, [])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Color Lab</h1>
      </header>
      <p className="hint">
        A dev harness; not linked anywhere in the app. Each club’s logo tiled
        against its known brand colors, to help pick a background for the
        home-slate card’s logo tile. Tap a swatch to mark your pick.
      </p>

      <div className="colorlab">
        {teams.map((id) => (
          <TeamColorRow key={id} teamId={id} pick={picks[id]} onPick={togglePick} />
        ))}
      </div>
    </div>
  )
}

function TeamColorRow({ teamId, pick, onPick }) {
  const name = teamFullName(teamId)
  const brandSwatches = teamColorSwatches(teamId)
  // Skip a neutral that just restates a brand color already shown (e.g. the
  // Orioles' and Reds' secondary is already pure black).
  const neutrals = NEUTRAL_SWATCHES.filter(
    (n) => !brandSwatches.some((b) => b.hex.toLowerCase() === n.hex.toLowerCase()), // caps-js-exempt
  )
  const swatches = [...brandSwatches, ...neutrals]
  const recommended = !pick ? RECOMMENDED_PICKS[teamId] : null
  const looseFit = LOOSE_FIT_TEAM_IDS.has(teamId)
  const altLogo = ALT_LOGOS[teamId]
  const cityConnect = CITY_CONNECT[teamId]

  return (
    <section className="colorlab__row">
      <h2 className="colorlab__teamname">{name}</h2>
      <div className="colorlab__swatches">
        {swatches.map((s) => {
          const isPicked = pick === s.label
          const isRecommended = !isPicked && recommended === s.label
          return (
            <button
              key={s.label}
              type="button"
              className={`colorlab__swatch ${isPicked ? 'colorlab__swatch--picked' : ''} ${isRecommended ? 'colorlab__swatch--recommended' : ''}`}
              aria-pressed={isPicked}
              title={isRecommended ? 'Claude’s recommendation' : undefined}
              onClick={() => onPick(teamId, s.label)}
            >
              <div
                className={`colorlab__logobox ${looseFit ? 'colorlab__logobox--loose' : ''}`}
                style={{ '--tint': s.hex }}
              >
                <TeamLogo teamId={teamId} name={name} size={56} />
              </div>
              <span className="colorlab__caption">{s.label}</span>
              <span className="colorlab__hex">{s.hex}</span>
            </button>
          )
        })}
      </div>

      {altLogo && (
        <ReferenceMarkRow label={`Alternate mark — ${altLogo.label}`} url={altLogo.url} swatches={swatches} />
      )}
      {cityConnect && (
        <ReferenceMarkRow
          label={`City Connect — ${cityConnect.label}`}
          url={cityConnect.url}
          swatches={swatches}
        />
      )}
    </section>
  )
}

// A non-interactive reference row: one fixed image (an alt logo or a City
// Connect uniform photo — see ALT_LOGOS / CITY_CONNECT) repeated across the
// same color swatches as the primary row above, so it can be eyeballed
// against each brand color too. Never carries the picked/recommended states —
// those only ever apply to the primary logo row's actual background decision.
function ReferenceMarkRow({ label, url, swatches }) {
  return (
    <>
      <p className="colorlab__altlabel">{label}</p>
      <div className="colorlab__swatches">
        {swatches.map((s) => (
          <div key={s.label} className="colorlab__swatch colorlab__swatch--static">
            <div className="colorlab__logobox colorlab__logobox--alt" style={{ '--tint': s.hex }}>
              <img src={url} alt="" className="colorlab__altimg" />
            </div>
            <span className="colorlab__caption">{s.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}
