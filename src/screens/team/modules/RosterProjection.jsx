import { DefenseDiamond } from '../../../components/DefenseDiamond.jsx'
import { RosterList } from './RosterList.jsx'

// One bordered soft-cream card (same convention as .tstats-card) around all
// the projection subsections, so they read as one group distinct from the
// actual 40-man list further down. The masthead is bolted directly onto its
// own top border rather than floating as a separate SectionTitle above it.
export function RosterProjection({
  hasRecentRoster,
  showRecentRoster,
  onShowSeason,
  onShowCurrent,
  rosterLineup,
  rosterSubs,
  rosterSP,
  rosterBullpen,
  injuredIds,
  season,
  isMilb,
}) {
  return (
    <div className="roster-super">
      <div className="roster-super__head">
        <span>Roster</span>
        {!hasRecentRoster && <em>preferred lineup</em>}
        {hasRecentRoster && (
          <div className="roster-super__toggle" role="tablist" aria-label="Roster projection basis">
            <button
              type="button"
              role="tab"
              aria-selected={!showRecentRoster}
              className={`roster-super__toggle-btn${!showRecentRoster ? ' is-active' : ''}`}
              onClick={onShowSeason}
            >
              Season
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showRecentRoster}
              className={`roster-super__toggle-btn${showRecentRoster ? ' is-active' : ''}`}
              onClick={onShowCurrent}
            >
              Current
            </button>
          </div>
        )}
      </div>
      <div className="roster-super__body">
      <div className="roster-super__row">
        {/* Left column: the defensive nine, with the bench (Top
            Substitutes) stacked directly beneath it. */}
        <div className="roster-super__col">
          {rosterLineup.length > 0 && (
            <section className="roster-sub">
              <h4 className="roster-sub__title">Preferred Lineup</h4>
              <DefenseDiamond defense={rosterLineup} />
            </section>
          )}
          {rosterSubs.length > 0 && (
            <section className="roster-sub">
              <h4 className="roster-sub__title">Top Substitutes</h4>
              <RosterList
                season={season}
                showProspect={isMilb}
                rows={rosterSubs.map((p) => ({
                  ...p,
                  hurt: injuredIds.has(p.id),
                }))}
              />
            </section>
          )}
        </div>
        {/* Right column: the two pitching staffs, Starting Pitchers
            over Bullpen. */}
        <div className="roster-super__col">
          {rosterSP.length > 0 && (
            <section className="roster-sub">
              <h4 className="roster-sub__title">Starting Pitchers</h4>
              <RosterList
                season={season}
                showProspect={isMilb}
                rows={rosterSP.map((p) => ({
                  ...p,
                  hurt: injuredIds.has(p.id),
                }))}
              />
            </section>
          )}
          {rosterBullpen.length > 0 && (
            <section className="roster-sub">
              <h4 className="roster-sub__title">Bullpen</h4>
              <RosterList
                season={season}
                showProspect={isMilb}
                rows={rosterBullpen.map((p) => ({
                  ...p,
                  hurt: injuredIds.has(p.id),
                }))}
              />
            </section>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
