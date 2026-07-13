import {
  loadManagerHistory,
  groupManagerialRecord,
  currentStint,
  lastManagerialStint,
} from '../api/managers.js'
import { fetchPerson, fetchPlayerAwards } from '../api/person-fetch.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'

// One person's career coaching page: a header (photo, current role or "last
// managed"), an awards strip, a compact per-team managerial win-loss record,
// and the full career timeline of every staff job he's held (Manager/Interim
// Manager visually distinct from assistant roles). Mirrors UmpirePage's shape
// (.scratch/manager-detail-page/plan.md §6) — no SealBox anywhere: a coaching
// career and its awards carry no live game's score, same footing as the
// umpire/milestone pages.
async function loadManager(id) {
  const [{ stints, generatedAt }, bio, awards] = await Promise.all([
    loadManagerHistory(id),
    fetchPerson(id),
    fetchPlayerAwards(id),
  ])
  if (!bio && stints.length === 0) return null
  return { bio, awards, stints, generatedAt }
}

function seasonLabel(startSeason, endSeason) {
  return startSeason === endSeason ? String(startSeason) : `${startSeason}–${endSeason}`
}

// The header's role/team line: this year's role if he's currently on a
// staff, else "Last managed {team}, {year}." off his most recent managerial
// stint, else (a career assistant who never managed) "Last coached {team},
// {year}." so the page never reads as a dead end.
function roleLine(stints) {
  const active = currentStint(stints)
  if (active) return `${active.job} · ${active.teamName}`
  const last = stints[stints.length - 1]
  if (!last) return ''
  const lastMgr = lastManagerialStint(stints)
  if (lastMgr) return `Last managed ${lastMgr.teamName}, ${lastMgr.season}.`
  return `Last coached ${last.teamName}, ${last.season}.`
}

export function ManagerPage({ id }) {
  const { loading, error, data } = useAsync(() => loadManager(id), [id])
  const back = () => window.history.back()
  useDocumentTitle(data?.bio?.fullName || null)

  const gate = AsyncGate({ loading, error, data, screenClass: 'manager', noun: 'manager', onBack: back })
  if (gate) return gate

  const { bio, awards, stints } = data
  const name = bio?.fullName || 'Manager'
  const active = currentStint(stints)
  const headshotTeamId = active?.teamId ?? stints[stints.length - 1]?.teamId ?? null
  const record = groupManagerialRecord(stints)

  return (
    <div className="screen manager">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="mgrpage__head">
        <Headshot personId={id} name={name} teamId={headshotTeamId} className="mgrpage__shot" />
        <div className="mgrpage__ident">
          <h1 className="mgrpage__name">{name}</h1>
          <p className="mgrpage__sub">{roleLine(stints)}</p>
        </div>
      </header>

      {awards.length > 0 && <AwardsStrip awards={awards} />}

      {record.length > 0 && <RecordTable rows={record} />}

      {stints.length > 0 && <CoachingTimeline stints={stints} />}
    </div>
  )
}

// A row of award pills — same idea as the player page's would-be awards
// strip, but this is the first surface that actually renders
// fetchPlayerAwards's output. Newest first.
function AwardsStrip({ awards }) {
  const sorted = [...awards].sort((a, b) => (b.season ?? 0) - (a.season ?? 0))
  return (
    <section className="mgrpage__card">
      <h2 className="mgrpage__cardtitle">Awards</h2>
      <ul className="mgrpage__awards">
        {sorted.map((a, i) => (
          <li key={`${a.id}-${a.season}-${i}`} className="mgrpage__award">
            <span className="mgrpage__awardseason">{a.season}</span>
            <span className="mgrpage__awardname">{a.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The managerial win-loss record, one row per continuous team stint (see
// groupManagerialRecord). A `sharedSeason` row shows the honest "split not
// yet recorded" caveat instead of a fabricated number — same
// graceful-degradation convention as the rest of this app's MiLB/umpire gaps.
function RecordTable({ rows }) {
  return (
    <section className="mgrpage__card">
      <h2 className="mgrpage__cardtitle">Managerial record</h2>
      <ul className="mgrpage__recordlist">
        {rows.map((r, i) => {
          const decisions = (r.w ?? 0) + (r.l ?? 0)
          const pct = decisions > 0 ? (r.w / decisions).toFixed(3).replace(/^0/, '') : null
          return (
            <li key={`${r.teamId}-${r.startSeason}-${i}`} className="mgrpage__recordrow">
              <TeamLink id={r.teamId} className="mgrpage__recordteam">
                <TeamLogo teamId={r.teamId} name={r.teamName} size={28} />
                <span className="mgrpage__recordteamname">{r.teamName}</span>
              </TeamLink>
              <span className="mgrpage__recordyears">{seasonLabel(r.startSeason, r.endSeason)}</span>
              {r.sharedSeason ? (
                <span className="mgrpage__recordcaveat">Shared season — split not yet recorded</span>
              ) : (
                <>
                  <span className="mgrpage__recordwl">
                    {r.w}-{r.l}
                  </span>
                  <span className="mgrpage__recordpct">{pct}</span>
                </>
              )}
              {r.interim && <span className="mgrpage__recordinterim">Interim</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// The full career timeline, every staff job chronologically — Manager/Interim
// Manager stints inked bold (they're the "story" of the page), assistant
// roles (Bench Coach, Pitching Coach, …) penciled in a lighter weight.
function CoachingTimeline({ stints }) {
  return (
    <section className="mgrpage__card">
      <h2 className="mgrpage__cardtitle">Coaching career</h2>
      <ul className="mgrpage__timeline">
        {stints.map((s, i) => (
          <li
            key={`${s.teamId}-${s.season}-${i}`}
            className={`mgrpage__timelinerow ${s.isManager ? 'mgrpage__timelinerow--mgr' : ''}`}
          >
            <span className="mgrpage__timelineseason">{s.season}</span>
            <TeamLogo teamId={s.teamId} name={s.teamName} size={20} />
            <span className="mgrpage__timelineteam">{s.teamName}</span>
            <span className="mgrpage__timelinejob">{s.job}</span>
            {s.isManager && (
              <span className="mgrpage__timelinerecord">
                {s.record ? `${s.record.w}-${s.record.l}` : 'Shared season'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
