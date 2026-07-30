import { TeamLogo } from '../../../components/TeamLogo.jsx'

// Which club is on the bench, and — because the real job is "work through all
// thirty" rather than "find one" — who's on deck. The arrows step the rail's
// own order, so a review pass is a loop you can hold a key through instead of
// thirty separate hunts down a sidebar.
export function CrestStrip({ team, badge, extra, prev, next, onStep }) {
  return (
    <header className="idlab__crest">
      <TeamLogo teamId={team.id} name={team.name} size={44} />
      <h2 className="idlab__crestname">{team.name}</h2>
      {badge}
      {extra}
      <div className="idlab__crestnav">
        <button
          type="button"
          className="idlab__stepbtn"
          onClick={() => onStep(prev.id)}
          title={`Previous club (←) — ${prev.name}`}
          aria-label={`Previous club — ${prev.name}`}
        >
          ‹
        </button>
        <button
          type="button"
          className="idlab__stepbtn"
          onClick={() => onStep(next.id)}
          title={`Next club (→) — ${next.name}`}
          aria-label={`Next club — ${next.name}`}
        >
          ›
        </button>
        <span className="idlab__ondeck">
          <span className="idlab__ondecklabel">On deck:</span>
          <TeamLogo teamId={next.id} name={next.name} size={20} />
        </span>
      </div>
    </header>
  )
}
