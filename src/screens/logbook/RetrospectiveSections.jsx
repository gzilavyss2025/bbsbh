import { eligibleHighlightForPlay } from '../../api/highlights.js'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { HighlightSheet } from '../../components/playbyplay/HighlightSheet.jsx'
import { dateLabel, SectionHead, gameTitle, LogbookGameLink } from './statsShared.jsx'

// The Logbook retrospective's ported First Scorebook sections — best
// individual performances, most memorable moments, combined leaders, and the
// rotation/bullpen split. Split out of LogbookStatsPage.jsx to keep that file
// under the file-size cap (ADR-0038); this is purely presentational over the
// `retro` object src/api/logbookRetrospective.js computes — no fetching, no
// game-state knowledge of its own.
//
// Same containment argument as the page it's rendered from (ADR-0035): every
// gamePk here already comes from the caller's own level-filtered stamps.
export function RetrospectiveSections({ retro, facts, loading, momentClips, openClip, onOpenClip, onCloseClip }) {
  const topMoments = retro.moments.slice(0, 7)

  return (
    <>
      {loading && <p className="hint hint--prose">Working out this book’s stats&hellip;</p>}

      {retro.performances.length > 0 && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Stars in your book"
            title="Best individual performances"
            note="The strongest single-game lines across every player and every club you’ve stamped."
          />
          <div className="logbookstats__performers">
            {retro.performances.slice(0, 8).map((p, index) => (
              <LogbookGameLink
                key={`${p.gamePk}-${p.playerId}-${p.type}`}
                gamePk={p.gamePk}
                facts={facts}
                className="logbookstats__performer"
              >
                <span className="logbookstats__performerRank">#{index + 1}</span>
                <Headshot personId={p.playerId} name={p.name} teamId={p.teamId} className="logbookstats__shot" />
                <span className="logbookstats__performerText">
                  <strong>{p.name}</strong>
                  <span>{p.team} · {dateLabel(p.date)}</span>
                  <b>{p.line}</b>
                </span>
              </LogbookGameLink>
            ))}
          </div>
        </section>
      )}

      {topMoments.length > 0 && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Turned the page"
            title="Most memorable moments"
            note="The biggest swings in win probability across your book — the plays where the whole shape of a game changed at once."
          />
          <ol className="logbookstats__moments">
            {topMoments.map((m) => {
              const items = momentClips?.[m.gamePk]
              const clip = items ? eligibleHighlightForPlay(items, m.playId) : null
              const game = facts?.[m.gamePk]
              return (
                <li key={`${m.gamePk}-${m.inning}-${m.description}`}>
                  <LogbookGameLink gamePk={m.gamePk} facts={facts} className="logbookstats__moment">
                    <span className="logbookstats__momentmeta">
                      <b>{m.half} {m.inning}</b>
                      <span>{dateLabel(m.date)}{game ? ` · ${gameTitle(game)}` : ''}</span>
                    </span>
                    <p className="logbookstats__prose">{m.description}</p>
                    <strong>{Math.round(m.swing)}-point swing</strong>
                  </LogbookGameLink>
                  {clip && (
                    <button type="button" className="logbookstats__watch" onClick={() => onOpenClip(clip)}>
                      ▶ Watch highlight
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
          {openClip && <HighlightSheet item={openClip} onClose={onCloseClip} />}
        </section>
      )}

      {(retro.battingLeaders.length > 0 || retro.pitchingLeaders.length > 0) && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Across your whole book"
            title="Combined leaders"
            note="Totals count only the games you’ve stamped, turning your book into its own miniature season."
          />
          <div className="logbookstats__leaderboards">
            <div className="logbookstats__leaders">
              <h3>At the plate</h3>
              <div className="logbookstats__leaderhead">
                <span>Player</span><span>H</span><span>HR</span><span>RBI</span><span>AVG</span>
              </div>
              {retro.battingLeaders.slice(0, 8).map((p) => (
                <div className="logbookstats__leaderrow" key={p.id}>
                  <span>
                    <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                    <b>{p.name}</b>
                    <small>{p.games} G</small>
                  </span>
                  <span>{p.batting.hits}</span>
                  <span>{p.batting.homeRuns}</span>
                  <span>{p.batting.rbi}</span>
                  <span>{p.average.toFixed(3).replace(/^0/, '')}</span>
                </div>
              ))}
            </div>
            <div className="logbookstats__leaders">
              <h3>On the mound</h3>
              <div className="logbookstats__leaderhead">
                <span>Pitcher</span><span>IP</span><span>K</span><span>ER</span><span>WHIP</span>
              </div>
              {retro.pitchingLeaders.slice(0, 8).map((p) => (
                <div className="logbookstats__leaderrow" key={p.id}>
                  <span>
                    <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                    <b>{p.name}</b>
                    <small>{p.games} G</small>
                  </span>
                  <span>{p.pitching.inningsPitched}</span>
                  <span>{p.pitching.strikeOuts}</span>
                  <span>{p.pitching.earnedRuns}</span>
                  <span>{p.whip.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {retro.rotation.length > 0 && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Arm by arm"
            title="Starting pitchers"
            note="Every pitcher who started a game you’ve stamped — his record, his team’s record behind him, and his line in those starts alone."
          />
          <div className="logbookstats__leaders">
            <div className="logbookstats__leaderhead">
              <span>Pitcher</span><span>GS</span><span>Record</span><span>Team</span><span>ERA</span>
            </div>
            {retro.rotation.map((p) => (
              <div className="logbookstats__leaderrow logbookstats__leaderrow--wide" key={p.id}>
                <span>
                  <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                  <b>{p.name}</b>
                  <small>{p.inningsPitched} IP</small>
                </span>
                <span>{p.gamesStarted}</span>
                <span>{p.wins}–{p.losses}</span>
                <span>{p.teamWins}–{p.teamLosses}</span>
                <span>{p.era.toFixed(2)}</span>
                <small className="logbookstats__leaderdetail">
                  {p.pitching.hits} H, {p.pitching.runs} R, {p.pitching.earnedRuns} ER, {p.pitching.baseOnBalls} BB,{' '}
                  {p.pitching.strikeOuts} SO · {Math.round(p.avgPitches)} pitches/start
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {retro.bullpen.length > 0 && (
        <section className="logbookstats__section">
          <SectionHead
            eyebrow="Out of the pen"
            title="Bullpen arms"
            note="Every reliever who pitched in a game you’ve stamped, across every appearance you’ve logged."
          />
          <div className="logbookstats__leaders">
            <div className="logbookstats__leaderhead">
              <span>Pitcher</span><span>G</span><span>SV</span><span>HLD</span><span>ERA</span>
            </div>
            {retro.bullpen.map((p) => (
              <div className="logbookstats__leaderrow logbookstats__leaderrow--wide" key={p.id}>
                <span>
                  <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                  <b>{p.name}</b>
                  <small>{p.inningsPitched} IP</small>
                </span>
                <span>{p.appearances}</span>
                <span>{p.saves}</span>
                <span>{p.holds}</span>
                <span>{p.era.toFixed(2)}</span>
                <small className="logbookstats__leaderdetail">
                  {p.pitching.hits} H, {p.pitching.runs} R, {p.pitching.earnedRuns} ER, {p.pitching.baseOnBalls} BB,{' '}
                  {p.pitching.strikeOuts} SO
                </small>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
