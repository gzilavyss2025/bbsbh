// Trophy Case — the player page's career-honors card (api/person.js's
// trophyCaseView): major hardware, All-Star selections, and in-season honors
// (Player of the Week/Month, Rookie/Reliever of the Month, ...), each
// collapsed into one badge per label with a count + the years/months it
// happened, rather than one badge per instance — a decorated veteran can rack
// up a dozen Player of the Week nods. Three glyphs, not one per award: a
// laurel medal for hardware, the same All-Star blue as the hero banner/career
// register for All-Star, a ribbon for in-season honors. Renders nothing when
// the player has none of the three, so a rookie's page just skips the card.
export function TrophyCase({ trophyCase }) {
  if (!trophyCase) return null
  const { hardware, allStar, inSeason } = trophyCase

  return (
    <div className="trophycase">
      <h3 className="section__title"><span>Trophy Case</span></h3>

      {hardware.length > 0 && (
        <Group label="Hardware">
          {hardware.map((h) => (
            <Badge key={h.key} icon={<HardwareIcon />} name={h.label} sub={h.sub} detail={h.detail} />
          ))}
        </Group>
      )}

      {allStar && (
        <Group label="All-Star">
          <Badge icon={<AllStarIcon />} name="All-Star" sub={allStar.sub} detail={allStar.detail} />
        </Group>
      )}

      {inSeason.length > 0 && (
        <Group label="In-season honors">
          {inSeason.map((h) => (
            <Badge key={h.key} icon={<InSeasonIcon />} name={h.label} sub={h.sub} detail={h.detail} />
          ))}
        </Group>
      )}
    </div>
  )
}

function Group({ label, children }) {
  return (
    <div className="trophycase__group">
      <p className="trophycase__grouplabel">{label}</p>
      <div className="trophycase__row">{children}</div>
    </div>
  )
}

function Badge({ icon, name, sub, detail }) {
  return (
    <div className="trophybadge">
      <div className="trophybadge__icon">{icon}</div>
      <p className="trophybadge__name">{name}</p>
      {sub && <p className="trophybadge__sub">{sub}</p>}
      {detail && <p className="trophybadge__detail">{detail}</p>}
    </div>
  )
}

function HardwareIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="19" r="15" fill="var(--award-soft)" stroke="var(--award-line)" strokeWidth="2" />
      <path
        d="M24 8 L26.6 15.2 34.2 15.5 28.1 20.1 30.3 27.3 24 23 17.7 27.3 19.9 20.1 13.8 15.5 21.4 15.2 Z"
        fill="var(--award-ink)"
      />
      <path d="M15 33 L24 38 33 33 33 46 24 42 15 46 Z" fill="var(--award-line)" />
    </svg>
  )
}

function AllStarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="17" fill="var(--paper-2)" stroke="var(--allstar-blue)" strokeWidth="2" />
      <path
        d="M24 12 L27.1 20.6 36 21 28.9 26.6 31.5 35.4 24 30.2 16.5 35.4 19.1 26.6 12 21 20.9 20.6 Z"
        fill="var(--allstar-blue)"
      />
    </svg>
  )
}

function InSeasonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 6 L40 14 V26 C40 35 33 41 24 43 C15 41 8 35 8 26 V14 Z"
        fill="var(--award-soft)"
        stroke="var(--award-line)"
        strokeWidth="2"
      />
      <path
        d="M17 24 L22 29 31 18"
        fill="none"
        stroke="var(--award-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
