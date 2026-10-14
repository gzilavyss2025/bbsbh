import { useState } from 'react'
import { BoxLinesDoor } from '../../../../../components/boxlines/BoxLinesDoor.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { doorLine } from '../../../../../api/boxlines/careerSplits.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { Cells, Chevron, Flag, Head, Part, Row } from './LineRows.jsx'

// Game lines (the board's fourth part): a career line under each facet, from the doors of
// cardFacets.js, each opening the games behind it. The facet list is the registry's; this file
// only draws it. `view` is gameLinesView's and `labels` the door labels it was built from.
export function GameLines({ view, labels, group, asOf, bio, surname }) {
  const layout = group === 'pitching' ? 'era' : 'slash'
  const [all, setAll] = useState(false)
  // The months open at first, the weekdays closed, as the board draws them.
  const [folds, setFolds] = useState({ month: true })
  // The folds the reader opened with a tap. Only those cascade: the month fold is open on load,
  // and its rows are not a change the reader made (docs/motion.md, "The one-shot gate").
  const [tapped, setTapped] = useState({})

  const sheetFor = (row) => ({
    personId: bio.id,
    playerSurname: surname,
    group,
    facet: row.facet ?? null,
    list: row.list ?? null,
    note: row.note,
    title: row.title(surname),
    footNote: row.footNote ?? null,
    cutoff: asOf ?? null,
  })

  const door = (line, sub, i = 0) =>
    line.list ? (
      <BoxLinesDoor
        key={line.key}
        className={`splitsmod__door splitsmod__door--list`}
        label={line.label}
        headline={null}
        face={
          <span className={`splitsmod__grid splitsmod__grid--${layout} is-dr is-list`}>
            <span className="splitsmod__label">
              <span className="splitsmod__name">{line.label}</span>
            </span>
            <Chevron />
          </span>
        }
        sheet={sheetFor(line.row)}
      />
    ) : (
      <BoxLinesDoor
        key={line.key}
        className={`splitsmod__door${sub ? ' is-sub' : ''}`}
        label={`${line.label}: ${doorLine(line.row, labels.get(line.key), group)}`}
        face={
          <span className={`splitsmod__grid splitsmod__grid--${layout} is-dr`}>
            <Cells quiet line={line} layout={layout} i={i} />
            <Chevron />
          </span>
        }
        sheet={sheetFor(line.row)}
      />
    )

  const sections = all ? view.sections : view.sections.slice(0, 1)
  return (
    <Part once={viewKey(bio.id, `splits-${group}:g`)} wide label="Game lines">
      <SectionHead look="rule" note="Career">Game lines</SectionHead>
      <Row dr base line={view.base} layout={layout} />
      {sections.map((s) => (
        <div className="splitsmod__sec" key={s.key}>
          <Head dr as="h4" layout={layout} title={s.title} group={group} vs="Career" />
          {s.items.map((item, n) =>
            item.fold ? (
              <div key={item.fold.key}>
                <button
                  type="button"
                  className="splitsmod__fold"
                  aria-expanded={Boolean(folds[item.fold.key])}
                  onClick={() => {
                    setFolds({ ...folds, [item.fold.key]: !folds[item.fold.key] })
                    setTapped({ ...tapped, [item.fold.key]: true })
                  }}
                >
                  <span className="splitsmod__foldchev" aria-hidden="true">›</span>
                  <span className="splitsmod__foldtext">
                    <span className="splitsmod__foldname">{item.fold.title}</span>
                    <span className="splitsmod__foldprev">
                      <span>{item.fold.count} splits</span>
                      {item.fold.best && <span className="splitsmod__pv"><Flag />{item.fold.best}</span>}
                      {item.fold.weak && <span className="splitsmod__pv"><Flag weak />{item.fold.weak}</span>}
                    </span>
                  </span>
                </button>
                {folds[item.fold.key] &&
                  item.fold.lines.map((l, i) => (
                    <div key={l.key} className={tapped[item.fold.key] ? 'splitsmod__appear' : undefined} style={{ '--i': i }}>
                      {door(l, true, i)}
                    </div>
                  ))}
              </div>
            ) : (
              door(item, false, n + 1)
            ),
          )}
        </div>
      ))}
      {view.sections.length > 1 && (
        <Button size="control" skin="outline" className="splitsmod__more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Part>
  )
}
