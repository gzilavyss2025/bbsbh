import '../../../../../styles/player-next/both/formchart.css'

// "How the stretches ended": one row per stretch of the Form trend chart, shared by the batter
// (#1889) and the pitcher (#1930) module. A row with an `at` jumps the chart's cursor there.
//
//   columns  [{ key, label }]: the figures after the name; a row reads `row[key]`.
//   rows     [{ key, name, sub, at, segs: [{ n, label }], good, bad, ...figures }]. `segs` run
//            left to right in the order of `legend`; `good` and `bad` ("55% on base") print under the bar.
//   legend   the outcome names, left to right.   ends  [left, right] names of the two winners.
//   cursor   the point the chart shows, so the row that sits on it reads as pressed.
export function StretchTable({ columns, rows, legend, ends, cursor, onPick }) {
  const cols = { '--fcols': columns.length }
  return (
    <div className="fstretch" style={cols}>
      <div className="fstretch__grid fstretch__head">
        <span>Stretch</span>
        {columns.map((c) => <span key={c.key}>{c.label}</span>)}
      </div>
      {rows.map((r) => {
        const body = (
          <>
            <span className="fstretch__grid">
              <span className="fstretch__name">
                <span className="fstretch__title">{r.name}</span>
                <span className="fstretch__sub">{r.sub}</span>
              </span>
              {columns.map((c) => <span key={c.key} className="fstretch__fig">{r[c.key]}</span>)}
            </span>
            <span className="fstretch__bar" aria-hidden="true">
              {r.segs.map((s, i) => (
                <span key={legend[i]} className="fstretch__seg" data-i={i} hidden={!s.n} style={{ flex: `${s.n} 1 0` }}>{s.label}</span>
              ))}
            </span>
            <span className="fstretch__ends" aria-hidden="true">
              <span className="fstretch__end fstretch__end--good">{r.good}</span>
              <span className="fstretch__end fstretch__end--bad">{r.bad}</span>
            </span>
          </>
        )
        const aria = `${r.name}: ${columns.map((c) => `${c.label} ${r[c.key]}`).join(', ')}, ${r.bad}`
        return r.at == null ? (
          <div key={r.key} className="fstretch__row" role="group" aria-label={aria}>{body}</div>
        ) : (
          <button key={r.key} type="button" className="fstretch__row fstretch__row--pick" aria-pressed={cursor === r.at} aria-label={aria} onClick={() => onPick(r.at)}>{body}</button>
        )
      })}
      <div className="fstretch__key">
        <div className="fstretch__keyhead"><span className="fstretch__end--good">{ends[0]}</span><span className="fstretch__end--bad">{ends[1]}</span></div>
        <div className="fstretch__bar" aria-hidden="true">
          {legend.map((name, i) => <span key={name} className="fstretch__seg" data-i={i}>{name}</span>)}
        </div>
      </div>
    </div>
  )
}
