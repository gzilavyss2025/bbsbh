import { useId, useState } from 'react'
import { isMlbTeamId } from '../../../lib/teams.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { Headshot } from '../../../components/player/Headshot.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { ProspectPill } from '../../../components/badges/ProspectPill.jsx'
import { useOvr } from '../../../components/ovr/useOvr.js'
import { DASH, Fact, debutLabel, draftLabel } from '../parts.jsx'
import { HERO_STAMP_DELAY, ageFact, headerExtras } from './heroData.js'
import { HeroActionPhoto } from './top/HeroActionPhoto.jsx'
import { HeroBand } from './top/HeroBand.jsx'
import { HeroStamp } from './top/HeroStamp.jsx'
import { HeroStrip } from './top/HeroStrip.jsx'
import '../../../styles/player-next/top/header-extras.css'

// The Age fact, as a button that flips to the birthday (D2-phone). The flip is
// the motion, so a reader who asked for less motion gets plain text.
function AgeFact({ fact, birthDate }) {
  const [flipped, setFlipped] = useState(false)
  const [still] = useState(motionIsReduced)
  if (still || !fact.flip) return <Fact label={fact.label} value={fact.value} />
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
            <span className="fact__value">{fact.value}</span>
          </span>
          <span className="pnext__ageface pnext__ageface--back" aria-hidden="true">
            <span className="fact__label">Birthday</span>
            <span className="fact__value">{debutLabel(birthDate)}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

// The page's top card (B-phone, D2-phone): photo left of the identity, then the
// fact strip. The position rule is PlayerHubShell's: DH/P for a two-way player,
// SP/RP/CL for a pitcher, the listed position for everyone else. The header extras (#2009) ride
// in it: the OVR stamp on the photo, the name-block extras, and the ratings strip, folded on load.
export function PlayerNextHero({ core }) {
  const { bio, rosterStatus: status, heroRole } = core
  const x = headerExtras(core, useOvr(bio))
  const stamp = x?.ratings[0]
  const [open, setOpen] = useState(false)
  // The action photo: 'wait' until it loads, 'ready' once shown, 'gone' after a 404.
  const [photo, setPhoto] = useState('wait')
  const stripId = useId()
  const club = status ? null : bio.team
  const pos = bio.twoWay ? 'DH/P' : (bio.isPitcher && heroRole) || bio.posAbbr
  const isMlb = isMlbTeamId(club?.id) || Boolean(status && bio.debut)
  const wash = isMlb && status?.state !== 'retired' && photo !== 'gone'
  // The fact grid has two columns, so an odd count lets the last cell span both and leaves no empty cell.
  const hasEdu = Boolean(x?.education)
  const hasNick = Boolean(x?.nickname)
  const odd = (6 + Number(Boolean(club || status)) + Number(Boolean(pos)) + Number(hasNick) + Number(hasEdu)) % 2 === 1
  const heightWeight = bio.heightWeight?.includes(' · ') ? `${bio.heightWeight} lb` : bio.heightWeight
  const role = bio.twoWay ? 'Two-way' : bio.isPitcher ? 'Pitcher' : 'Batter'
  return (
    <Card as="div" frame="stamped" body="flush" stampIn className="pnext__hero" style={{ '--stamp-delay': HERO_STAMP_DELAY }}>
      <HeroBand core={core} />
      <div className={`pnext__id${wash ? ' pnext__id--wash' : ''}${photo === 'ready' ? ' pnext__id--photo' : ''}`}>
        {wash && (
          <HeroActionPhoto
            personId={bio.id}
            ready={photo === 'ready'}
            onReady={() => setPhoto('ready')}
            onGone={() => setPhoto('gone')}
          />
        )}
        <Headshot
          personId={bio.id}
          name={bio.fullName}
          teamId={club?.parentOrgId ?? club?.id}
          isMlb={isMlb}
          className="pnext__shot"
        />
        <div className="pnext__who">
          <p className="pnext__role">{[pos || role, bio.number && `#${bio.number}`].filter(Boolean).join(' · ')}</p>
          <h1 className="pnext__name">{bio.fullName}</h1>
          {(club || x?.rank || x?.orgRank) && (
            <p className="pnext__club">
              {club && (
                <TeamLink id={club.id}>
                  <TeamLogo teamId={club.id} name={club.name} size={28} />
                </TeamLink>
              )}
              <ProspectPill rank={x?.rank} />
              <ProspectPill
                orgRank={x?.orgRank}
                orgTeamId={club?.parentOrgId ?? club?.id}
                orgTeamName={club?.parentOrgName ?? club?.name}
              />
            </p>
          )}
        </div>
        {stamp && <HeroStamp view={stamp} open={open} controls={stripId} onToggle={() => setOpen((o) => !o)} />}
      </div>
      <FactGrid look="strip" as="div" className="pnext__facts">
        {club ? (
          <Fact label="Team" value={<TeamLink id={club.id}>{club.name}</TeamLink>} />
        ) : (
          status && <Fact label="Status" value={status.label} />
        )}
        {pos && <Fact label="Position" value={pos} />}
        <Fact label="Bats / Throws" value={`${bio.bats || DASH} / ${bio.throws || DASH}`} />
        <AgeFact fact={ageFact(bio, status)} birthDate={bio.birthDate} />
        <Fact label="Height / Weight" value={heightWeight} />
        <Fact label="Born" value={bio.born} />
        <Fact label="MLB debut" value={bio.debut ? debutLabel(bio.debut) : DASH} />
        <Fact label="Draft" value={draftLabel(bio.draft, bio.signedYear)} wide={odd && !hasNick && !hasEdu} />
        {hasNick && <Fact label="Nickname" value={`“${x.nickname}”`} wide={odd && !hasEdu} />}
        {hasEdu && <Fact label="School" value={x.education} wide={odd} />}
      </FactGrid>
      {stamp && <HeroStrip id={stripId} ratings={x.ratings} open={open} />}
    </Card>
  )
}
