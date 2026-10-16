import { useMemo, useRef, useState, useEffect } from 'react'
import { BoxLinesDoor } from '../../../../../components/boxlines/BoxLinesDoor.jsx'
import { bandFor } from '../../../../../components/boxlines/bandFor.js'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { vsTeamDoorLabel } from '../../../../../api/vsTeamSplits.js'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { teamClubName, teamLocationName } from '../../../../../lib/teams.js'
import { Cells, Chevron, Head, Part, Row } from './LineRows.jsx'
import { asBase, clubChip, figLine, meetingDate, readFigs, vsTeamLine } from './splitsView.js'

// Splits vs team (the board's third part): a career line against one club, from the nightly
// shard. A strip of every club picks the opponent; the door under the figures opens the games.
// `career` is the career regular-season stat the row is read against.
export function VsTeam({ vs, group, career, season, asOf, bio, surname }) {
  const layout = group === 'pitching' ? 'era' : 'slash'
  const [pick, setPick] = useState(vs.preselectId)
  const [open, setOpen] = useState(false)
  const stripRef = useRef(null)
  const activeRef = useRef(null)
  // Keep the picked club centred in the strip, scrolling the strip itself and not the page. The
  // first centre is instant; a club the reader picks glides there (board Splits, center()).
  const centred = useRef(pick)
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    const glide = centred.current !== pick && !motionIsReduced()
    centred.current = pick
    if (strip && btn) strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2, behavior: glide ? 'smooth' : 'auto' })
  }, [pick])

  const team = vs.teams.find((t) => t.id === pick) ?? vs.teams[0]
  const entry = team ? vs.byOpp[String(team.id)] : null
  const baseLine = useMemo(() => {
    const line = career && figLine('career', 'Career', career, group)
    return line ? asBase(line) : null
  }, [career, group])
  const raw = entry?.car && vsTeamLine(entry.car, `vs ${team.abbr}`, group)
  const line = raw ? readFigs(baseLine, [raw], group)[0] : null
  // The last meeting is a game result: a dated page holds back one on or after its day.
  const last = entry?.last && (!asOf || entry.last.date < asOf) ? entry.last : null
  const clubName = team ? [teamLocationName(team.id), teamClubName(team.id)].filter(Boolean).join(' ') || team.name : ''

  return (
    <Part once={viewKey(bio.id, `splits-${group}:v`)} wide label="Splits vs team">
      <SectionHead look="rule" note={`Career vs ${team?.abbr ?? ''}`}>Splits vs team</SectionHead>
      <div className="splitsmod__strip" role="group" aria-label="Opponent" ref={stripRef}>
        {vs.teams.map((t) => {
          const chip = clubChip(t, vs.byOpp[String(t.id)], group)
          const active = t.id === team?.id
          return (
            <button
              key={t.id}
              type="button"
              className={`splitsmod__club${chip.faced ? '' : ' is-none'}`}
              aria-pressed={active}
              aria-label={chip.aria}
              ref={active ? activeRef : null}
              onClick={() => setPick(t.id)}
            >
              {t.id === vs.preselectId && <span className="splitsmod__next">Next</span>}
              <TeamLogo teamId={t.id} name={t.name} size={34} />
              <span className="splitsmod__abbr">{t.abbr}</span>
              <span className={`splitsmod__chipfig${chip.thin ? ' is-thin' : ''}`}>{chip.text}</span>
            </button>
          )
        })}
      </div>
      <div className="splitsmod__clubhead" aria-live="polite">
        <TeamLogo teamId={team?.id} name={clubName} size={30} />
        <span className="splitsmod__clubname">{clubName}</span>
        {team?.id === vs.preselectId && <span className="splitsmod__nexttag">Next opponent</span>}
      </div>
      <Head dr layout={layout} title="Career" group={group} vs="Career" />
      {open && baseLine && <Row dr base line={baseLine} layout={layout} />}
      {line ? (
        <BoxLinesDoor
          key={team.id}
          className="splitsmod__door"
          label={vsTeamDoorLabel(entry.car, group, team.abbr)}
          face={
            <span className={`splitsmod__grid splitsmod__grid--${layout} is-dr`}>
              <Cells quiet line={line} layout={layout} i={1} />
              <Chevron />
            </span>
          }
          sheet={{
            personId: bio.id,
            playerSurname: surname,
            group,
            opponentId: team.id,
            opponentName: teamClubName(team.id) ?? team.name,
            cutoff: asOf ?? null,
            band: bandFor(bio.team?.id),
          }}
        />
      ) : (
        <p className="splitsmod__none">{group === 'pitching' ? `Has not faced the ${teamClubName(team?.id) ?? 'club'} in the majors.` : `No career meetings vs the ${teamClubName(team?.id) ?? 'club'}.`}</p>
      )}
      {open && last && (
        <div className="splitsmod__last">
          <p className="splitsmod__lastlabel">Last game against {teamLocationName(team.id) ?? team.name}</p>
          <p className="splitsmod__lastline">
            {meetingDate(last.date, season)} {last.home ? 'vs' : '@'} {teamClubName(team.id) ?? last.opp}
            <span className="splitsmod__sep">|</span>
            {last.line}
          </p>
        </div>
      )}
      <Button size="control" skin="outline" className="splitsmod__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Show less' : 'Show more'}
      </Button>
    </Part>
  )
}
