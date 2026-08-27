// The ranked shortlist in the CHOOSE mode of the contract identity workbench.
//
// Three things a comma-joined line of text was hiding, and each one is why a
// reviewer had to read instead of look:
//   - the SCORE, which is a comparison and belongs on a bar, not in a number;
//   - the REASONS, which are a set of independent signals ("position match",
//     "service-time plausible") and belong in separate chips, because two
//     reasons and one reason are supposed to look different;
//   - the DIFFERING WORD, which is the whole decision and was previously the
//     hardest thing on the row to see.
import { diffNames } from '../../../lib/admin/nameDiff.js'

// The numbers a reviewer can press. Past nine there is no key left, so the
// rest carry no badge rather than a badge that lies about a shortcut.
const KEYED = 9

function NameDiff({ rawName, name }) {
  const { candidate } = diffNames(rawName, name)
  return (
    <span className="cwb__candname">
      {candidate.map((seg, i) =>
        seg.differs ? (
          <mark key={i} className="cwb__diff">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}

function scorePercent(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n * 100)))
}

export function CandidateList({ rawName, candidates, onPick, disabled, showRowShare }) {
  if (!candidates?.length) {
    return (
      <p className="cwb__hint caps-exempt">
        No shortlist — this name has nothing to rank. Search the season roster below, or say no
        match exists.
      </p>
    )
  }

  return (
    <ol className="cwb__cands">
      {candidates.map((c, i) => {
        const pct = scorePercent(c.score)
        return (
          <li key={c.id} className="cwb__cand">
            <span className="cwb__candkey" aria-hidden="true">
              {i < KEYED ? i + 1 : '·'}
            </span>
            <div className="cwb__candbody">
              <p className="cwb__candline caps-exempt">
                <NameDiff rawName={rawName} name={c.lastFirstName} />
                <span className="cwb__candid">id {c.id}</span>
              </p>
              <div className="cwb__scorerow">
                <span className="cwb__scorebar">
                  <span className="cwb__scorefill" style={{ width: `${pct}%` }} />
                </span>
                <span className="cwb__scorenum caps-exempt">{pct}</span>
              </div>
              <ul className="cwb__chips">
                {(c.reasons ?? []).map((reason) => (
                  <li key={reason} className="cwb__chip caps-exempt">
                    {reason}
                  </li>
                ))}
                {!(c.reasons ?? []).length && (
                  <li className="cwb__chip cwb__chip--none caps-exempt">no context clues</li>
                )}
                {showRowShare && c.ofRows > 1 && (
                  <li className="cwb__chip cwb__chip--share caps-exempt">
                    in {c.inRows} of {c.ofRows} rows
                  </li>
                )}
              </ul>
            </div>
            <button
              type="button"
              className={`cwb__use${i === 0 ? ' cwb__use--primary' : ''}`}
              disabled={disabled}
              onClick={() => onPick(c.id)}
            >
              {i === 0 ? 'Use — top match' : 'Use'}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
