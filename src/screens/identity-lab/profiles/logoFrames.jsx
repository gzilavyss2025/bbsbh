/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, matching the neighboring read-only
   audit profile; this dev-only lab can safely fall back to a full reload. */
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { teamChipColors, teamFullName } from '../../../lib/teams.js'

// A read-only comparison board for logo framing ideas. These deliberately use
// the production TeamLogo component and each club's real brand pair, so wide,
// tall, circular, and dense marks expose a weak direction here before any
// homepage, inning, team-profile, or box-score surface adopts it.
const TEAMS = [
  { id: 158, short: 'Brewers', shape: 'dense' },
  { id: 138, short: 'Cardinals', shape: 'wide', variant: 'wordmark', flipFrame: true },
  { id: 111, short: 'Red Sox', shape: 'tall' },
  { id: 112, short: 'Cubs', shape: 'round' },
]

const CONCEPTS = [
  {
    key: 'register',
    number: '01',
    title: 'Offset register',
    note: 'Polished from the supplied sketch',
    description:
      'The mark breaks above and left of a solid team-color field while an offset rule holds the lower-right corner. It keeps the bold patch feeling without forcing the art to obey the square.',
  },
  {
    key: 'halo',
    number: '02',
    title: 'Open halo',
    note: 'Best all-purpose option',
    description:
      'Two incomplete color rings create presence without enclosing the mark. The open side gives wide and tall art somewhere to breathe, while circular marks still feel intentional.',
  },
  {
    key: 'pennant',
    number: '03',
    title: 'Pennant tab',
    note: 'Strongest on the homepage',
    description:
      'A shallow pennant sits behind the logo instead of a tile. Its horizontal pull welcomes wide marks, and vertical marks can rise above it without looking undersized.',
  },
  {
    key: 'baseline',
    number: '04',
    title: 'Baseline rail',
    note: 'Strongest in innings',
    description:
      'The logo straddles a short scorebook rule with a colored end cap. There is no container to fight, and the same idea scales cleanly from a section masthead to a compact row.',
  },
  {
    key: 'corners',
    number: '05',
    title: 'Open corners',
    note: 'Quietest treatment',
    description:
      'Two registration corners imply a frame but never close it. This keeps club colors present around very pale or very dark marks without adding another heavy block.',
  },
  {
    key: 'seal',
    number: '06',
    title: 'Scorebook seal',
    note: 'Most characterful option',
    description:
      'A soft, irregular paper seal replaces the square with a tactile scorebook sticker. The mark can overlap its edge, so the silhouette—not the source canvas—sets the visual size.',
  },
]

function LogoSample({ team, concept }) {
  const colors = teamChipColors(team.id)
  const style = {
    '--frame-fill': team.flipFrame ? colors?.secondary : colors?.primary,
    '--frame-accent': team.flipFrame ? colors?.primary : colors?.secondary,
  }

  return (
    <figure className="logoframes__sample" style={style}>
      <div className={`logoframes__stage logoframes__stage--${concept}`}>
        <span className="logoframes__shape" aria-hidden="true" />
        <TeamLogo
          teamId={team.id}
          name={teamFullName(team.id)}
          size={104}
          variant={team.variant}
          className={`logoframes__logo--${team.shape}`}
        />
      </div>
      <figcaption>
        <strong>{team.short}</strong>
        <span>{team.shape}</span>
      </figcaption>
    </figure>
  )
}

function LogoFramesBody() {
  return (
    <div className="logoframes">
      <div className="logoframes__legend" aria-label="Test logo silhouettes">
        {TEAMS.map((team) => (
          <span key={team.id}>
            <strong>{team.short}</strong> · {team.shape}
          </span>
        ))}
      </div>

      {CONCEPTS.map((concept) => (
        <section className="logoframes__concept" key={concept.key}>
          <header className="logoframes__head">
            <span className="logoframes__number">{concept.number}</span>
            <div>
              <h2>{concept.title}</h2>
              <span className="logoframes__note">{concept.note}</span>
            </div>
          </header>
          <p>{concept.description}</p>
          <div className="logoframes__samples">
            {TEAMS.map((team) => (
              <LogoSample key={team.id} team={team} concept={concept.key} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export const logoFramesProfile = {
  key: 'logo-frames',
  label: 'Logo frames',
  title: 'Team Identity Lab — Logo frames',
  hint: (
    <>
      Six read-only directions for letting a club mark escape the square. Each is stress-tested against
      dense, wide, tall, and circular MLB silhouettes in contrasting palettes; no production surface is
      changed by this lab.
    </>
  ),
  Body: LogoFramesBody,
}
