// The Splits card's table parts (#1886): the head and the cells of one row. Two grids share them:
// 'slash' (PA or BF, AVG/OBP/SLG, the OPS bar, HR, K%, BB%) and 'era' (G, IP, the ERA bar, K, BB).
// A row is a line of splitsView.js; the bar is drawn from its `fill` and `tick`.
const DASH = '—'

export function Flag({ weak }) {
  return (
    <svg className={`splitsmod__flag${weak ? ' is-weak' : ''}`} width="22" height="22" viewBox="0 0 22 22" role="img" aria-label={weak ? 'Weakest in its group' : 'Best in its group'}>
      <rect x="2" y="2" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  )
}

export function Head({ layout, title, group, vs, dr, as: Title = 'span' }) {
  const metric = layout === 'era' ? 'ERA' : group === 'pitching' ? 'OPS against' : 'OPS'
  const bar = `${metric} vs ${vs}`
  return (
    <div className={`splitsmod__head splitsmod__grid splitsmod__grid--${layout}${dr ? ' is-dr' : ''}`}>
      <Title className="splitsmod__headtitle">{title}</Title>
      {layout === 'era' ? (
        <>
          <span>G</span>
          <span>IP</span>
          <span className="splitsmod__wide">{bar}</span>
          <span>K</span>
          <span>BB</span>
        </>
      ) : (
        <>
          <span>{group === 'pitching' ? 'BF' : 'PA'}</span>
          <span>
            AVG<span className="splitsmod__wide">/OBP/SLG</span>
          </span>
          <span className="splitsmod__wide">{bar}</span>
          <span>HR</span>
          <span>K%</span>
          <span>BB%</span>
        </>
      )}
      {dr && <span />}
    </div>
  )
}

// The OPS or ERA bar of one row: the fill, the baseline tick, the figure, the delta and the thin tag.
function Bar({ line, metric }) {
  const figure = metric === 'era' ? line.era : line.ops
  return (
    <span className="splitsmod__ops">
      <span className={`splitsmod__track${line.none ? ' is-none' : ''}`}>
        {line.fill && <span className={`splitsmod__fill is-${line.fill.kind}`} style={{ transform: `scaleX(${line.fill.scale})` }} />}
        {line.tick != null && <span className="splitsmod__tick" style={{ left: `${line.tick}%` }} />}
      </span>
      <span className="splitsmod__fig">{figure}</span>
      <span className={`splitsmod__delta${line.thin ? '' : line.fill?.kind === 'pos' ? ' is-pos' : line.fill?.kind === 'neg' ? ' is-neg' : ''}`}>{line.delta}</span>
      <span className={line.thin ? 'splitsmod__thin' : undefined}>{line.thin ? 'thin' : ''}</span>
    </span>
  )
}

// The cells of one row. `read` (the line's sentence) is the row's accessible text; a door row
// names itself through its button instead, so it passes `quiet`.
export function Cells({ line, layout, quiet }) {
  const has = !line.none
  const cell = (v) => (has && v != null ? v : DASH)
  return (
    <>
      <span className="splitsmod__label">
        <span className="splitsmod__name">
          <span className={line.nested ? 'is-nested' : undefined}>{line.label}</span>
          {line.best && <Flag />}
          {line.weak && <Flag weak />}
        </span>
        {!quiet && line.read && <span className="sr-only">{line.read}</span>}
      </span>
      {layout === 'era' ? (
        <>
          <span className="splitsmod__cell">{line.g ?? DASH}</span>
          <span className="splitsmod__cell">{cell(line.ip)}</span>
          <Bar line={line} metric="era" />
          <span className="splitsmod__cell">{cell(line.k)}</span>
          <span className="splitsmod__cell">{cell(line.bb)}</span>
        </>
      ) : (
        <>
          <span className="splitsmod__cell">{has ? cell(line.count) : `${line.g} G`}</span>
          <span className="splitsmod__cell">
            {cell(line.avg)}
            <span className="splitsmod__wide">{has ? line.rest : ''}</span>
          </span>
          <Bar line={line} metric="ops" />
          <span className="splitsmod__cell">{cell(line.hr)}</span>
          <span className="splitsmod__cell">{cell(line.k)}</span>
          <span className="splitsmod__cell">{cell(line.bb)}</span>
        </>
      )}
    </>
  )
}

export function Row({ line, layout, base, dr }) {
  return (
    <div className={`splitsmod__row splitsmod__grid splitsmod__grid--${layout}${dr ? ' is-dr' : ''}${base ? ' is-base' : ''}`}>
      <Cells line={line} layout={layout} />
    </div>
  )
}

export function Chevron() {
  return (
    <span className="splitsmod__chev" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M5 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    </span>
  )
}
