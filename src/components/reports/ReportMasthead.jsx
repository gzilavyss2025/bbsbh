// The broadcast masthead every page under /reports opens on.
//
// WHY THESE PAGES LOOK DIFFERENT FROM THE REST OF THE APP, ON PURPOSE. The
// scoring surfaces are a paper scorebook: manila, pencil rules, kraft seals,
// nothing shouting. A REPORT is not a scorebook page — it is the segment
// between innings, and it should read like a graphics package: a hard navy
// slab, a seam-red bar down its edge, the title in condensed capitals at a
// size no scorebook cell would ever use, and the sample size stated in mono
// under it like a lower third.
//
// It is drawn ENTIRELY from the existing tokens — --navy, --clay, --font-
// display, --font-mono — so it is the same ink the app has always used,
// arranged like a broadcast instead of like a page. Nothing here introduces a
// colour, and the global uppercase invariant does the shouting for free.
//
// `eyebrow` is the strand ('The Gate'), `title` the page, `dek` the one
// sentence that says what the reader is looking at, and `meta` the lower third
// — season, through-date, sample size — as { label, value } pairs.
export function ReportMasthead({ eyebrow, title, dek, meta = [] }) {
  return (
    <header className="bcast">
      <div className="bcast__bar" aria-hidden="true" />
      <div className="bcast__body">
        <p className="bcast__eyebrow">
          <span className="bcast__strand">Tally Reports</span>
          {eyebrow ? <span className="bcast__slash">/</span> : null}
          {eyebrow ? <span>{eyebrow}</span> : null}
        </p>
        <h1 className="bcast__title">{title}</h1>
        {dek ? <p className="bcast__dek">{dek}</p> : null}
        {meta.length > 0 && (
          <dl className="bcast__meta">
            {meta.map((m) => (
              <div key={m.label} className="bcast__metaitem">
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  )
}

// A section rule with a title — the "coming up next" divider between blocks of
// a report. Kept here rather than in each page so the six pages cannot each
// invent their own heading treatment.
export function ReportSection({ title, note, children }) {
  return (
    <section className="bcast-sec">
      <h2 className="bcast-sec__title">{title}</h2>
      {note ? <p className="bcast-sec__note">{note}</p> : null}
      {children}
    </section>
  )
}
