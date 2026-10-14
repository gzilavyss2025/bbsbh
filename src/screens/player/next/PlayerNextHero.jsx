import { useState } from 'react'
import { isMlbTeamId } from '../../../lib/teams.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { Headshot } from '../../../components/player/Headshot.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { DASH, Fact, debutLabel, draftLabel } from '../parts.jsx'
import { ageFact } from './heroData.js'
import { HeroBand } from './top/HeroBand.jsx'

// The Age fact, as a button that flips to the birthday (D2-phone). The flip is
// the motion, so a reader who asked for less motion gets plain text.
function AgeFact({ fact, birthDate }) {
  const [flipped, setFlipped] = useState(false)
  const [still] = useState(motionIsReduced)
  if (still || !fact.flip) return <Fact label={fact.label} value={fact.value} mono />
  return (
    <div className="fact fact--flip">
      <button
        type="button"
        className={`pnext__agebtn${flipped ? ' is-flipped' : ''}`}
        aria-pressed={flipped}
        aria-label={`Age ${fact.value}. Tap to flip to his birthday.`}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="pnext__ageflip">
          <span className="pnext__ageface">
            <span className="fact__label">Age</span>
            <span className="fact__value mono">{fact.value}</span>
          </span>
          <span className="pnext__ageface pnext__ageface--back" aria-hidden="true">
            <span className="fact__label">Birthday</span>
            <span className="fact__value mono">{debutLabel(birthDate)}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

// The page's top card (B-phone, D2-phone): photo left of the identity, then the
// fact strip. The position rule is PlayerHubShell's: DH/P for a two-way player,
// SP/RP/CL for a pitcher, the listed position for everyone else.
export function PlayerNextHero({ core }) {
  const { bio, rosterStatus: status, heroRole } = core
  const club = status ? null : bio.team
  const pos = bio.twoWay ? 'DH/P' : (bio.isPitcher && heroRole) || bio.posAbbr
  const role = bio.twoWay ? 'Two-way' : bio.isPitcher ? 'Pitcher' : 'Batter'
  return (
    <Card as="div" frame="stamped" body="flush" stampIn className="pnext__hero">
      <HeroBand core={core} />
      <div className="pnext__id">
        <Headshot
          personId={bio.id}
          name={bio.fullName}
          teamId={club?.parentOrgId ?? club?.id}
          isMlb={isMlbTeamId(club?.id) || Boolean(status && bio.debut)}
          className="pnext__shot"
        />
        <div className="pnext__who">
          <p className="pnext__role">{[role, bio.number && `#${bio.number}`].filter(Boolean).join(' · ')}</p>
          <h1 className="pnext__name">{bio.fullName}</h1>
          <p className="pnext__club">
            {club && <TeamLogo teamId={club.id} name={club.name} size={22} />}
            {club ? <TeamLink id={club.id}>{club.name}</TeamLink> : status && <span>{status.label}</span>}
            {pos && <Pill fill="paper">{pos}</Pill>}
          </p>
        </div>
      </div>
      <FactGrid look="strip" as="div">
        <Fact label="Bats / Throws" value={`${bio.bats || DASH} / ${bio.throws || DASH}`} mono />
        <AgeFact fact={ageFact(bio, status)} birthDate={bio.birthDate} />
        <Fact label="Ht / Wt" value={bio.heightWeight} mono />
        <Fact label="Born" value={bio.born} />
        <Fact label="MLB debut" value={bio.debut ? debutLabel(bio.debut) : DASH} mono />
        <Fact label="Draft" value={draftLabel(bio.draft, bio.signedYear)} mono />
      </FactGrid>
    </Card>
  )
}
