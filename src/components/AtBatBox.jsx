import { PlayDiamond } from './PlayDiamond.jsx'

// One at-bat box on the scorecard, drawn like the Numbers Game "22" sheet: a top
// row of two boxes — the at-bat OUTCOME and the RBIs it drove in — with the base
// diamond below, a gray "out" circle on the divider (the scorer pencils 1/2/3 and
// rings it), and a pitch strip of one white BALLS column and two darker STRIKES
// columns down the right edge.
//
// Milestone 1 renders every zone blank — the printed template, nothing filled.
// `atbat` (a computeHalfInningFeed entry, wired in a later milestone) will fill
// the outcome/RBI/out and drive the diamond via PlayDiamond's props, so the box
// shape here doesn't change when the data arrives.
export function AtBatBox({ atbat = null }) {
  return (
    <div className="sc-ab">
      <div className="sc-ab__main">
        <div className="sc-ab__head">
          <span className="sc-ab__result">{atbat?.code ?? ''}</span>
          <span className="sc-ab__rbi">{atbat?.rbi ? atbat.rbi : ''}</span>
        </div>
        <div className="sc-ab__diamond">
          <PlayDiamond
            reached={atbat?.reached ?? 0}
            scored={atbat?.scored ?? false}
            legNotations={atbat?.legNotations ?? {}}
            outAt={atbat?.outAt ?? null}
            outCode={atbat?.outCode ?? ''}
            size={52}
          />
        </div>
        <span className="sc-ab__out">{atbat?.outNumber ?? ''}</span>
      </div>
      <div className="sc-ab__strip" aria-hidden="true">
        <span className="sc-ab__balls" />
        <span className="sc-ab__strike" />
        <span className="sc-ab__strike" />
      </div>
    </div>
  )
}
