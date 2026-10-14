import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'

// The club band that heads a card (Starting pitcher, Batting order, Defensive alignment):
// the title, an optional control, and the club's mono mark at the far right (ADR-0031).
// The colours come from the theme on the card root (ADR-0030).
export function ClubBar({ title, teamId, teamName, masthead, season, children }) {
  return (
    <SectionHead
      look="band"
      as="h3"
      action={children}
      mark={
        <TeamLogo
          teamId={teamId}
          name={teamName}
          size={22}
          variant="mono"
          crop="bar"
          overrideUrl={masthead.url}
          season={season}
          className={`sectionhead__mark${masthead.url ? ' sectionhead__mark--custom' : ''}`}
        />
      }
    >
      {title}
    </SectionHead>
  )
}
