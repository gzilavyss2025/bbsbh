import { useMemo, useState } from 'react'
import { totalsOf } from '../../../api/scout/headToHead.js'
import { fetchVsPlayerTotal } from '../../../api/scout/vsPlayer.js'
import { useInViewOnce } from '../../../hooks/scroll/useInViewOnce.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { rate3 } from '../../../api/person/shared.js'
import { humanDateWithYear, monthDayName } from '../../../lib/dates.js'
import { glyphD } from '../../../lib/pitch/pitchGlyph.js'
import { pitchMark } from '../../../lib/pitch/pitchTypes.js'
import { AsyncStatus } from '../../../components/ui/AsyncGate.jsx'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { callOf, gamesOf, inPlay, meetingFacts, mixRows, nameOf, meetingOrdinal, pitchWalk, playText, resultWord, scoringMark, unseenNote } from './meetings.js'
import { PitchModal } from './PitchModal.jsx'
import { ContactLine, MeetingFacts, fixed } from './Facts.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'

// THE MEETINGS TAB (#1490, was the head-to-head list of #1410): every past
// plate appearance between the two, pitch by pitch. A facts row, the pitch
// mix in the meetings against this season's, then one card per plate
// appearance with a button per pitch. A pitch button opens the pitch modal:
// its real flight, its numbers, and its film, the way the Express Lane plays it.
//
// THE CUTOFF IS THE SPOILER RULE HERE. This open page (ADR-0034) could
// otherwise name tonight's meeting, so the request holds back every game
// dated on or after `cutoff`: today, or `?d=` (ADR-0087, ADR-0088). The
// module sends Savant the day before it, because Savant's bounds are
// inclusive. The film lookup refuses the
// same games (api/scout/playIds.js).
//
// ScoutPage reads the head-to-head (so the jump bar can count it) and filters
// the plate appearances by scope; every figure here is rebuilt from those same rows, so the facts and the list cannot disagree.
//
// Every pitch wears its pitchMark(code) colour and shape, as in the Pitches section (docs/pitch-types.md).
// A pitch's mark: its shape in its colour, drawn the way the Pitches section's rows draw it.
function Mark({ code }) {
  const mark = pitchMark(code)
  return (
    <svg className="scout__mark" width="12" height="12" viewBox="-11 -11 22 22" aria-hidden="true">
      <path d={glyphD(mark.shape, 7)} style={{ '--pitch': mark.color }} data-ring={mark.ring || undefined} />
    </svg>
  )
}

// One bar: a segment per pitch in its mark's colour, no numbers inside. The shares are in the
// sentence under the bars, and in the bar's own label for a screen reader.
function MixBar({ rows, pick, label }) {
  const shares = rows.filter((r) => pick(r) > 0)
  return (
    <span className="scout__mixbar" role="img" aria-label={`${label}: ${shares.map((r) => `${r.name} ${pick(r)}%`).join(', ')}`}>
      {shares.map((r) => (
        <span key={r.code} className="scout__mixseg" style={{ '--pitch': pitchMark(r.code).color, width: `${pick(r)}%` }} />
      ))}
    </span>
  )
}

export function MeetingsPanel({ data, board, h2h, pas, cutoff, view, stance, hitterStance }) {
  const games = useMemo(() => gamesOf(pas), [pas])
  const walk = useMemo(() => pitchWalk(games), [games])
  const [open, setOpen] = useState(null)
  const [ref, phase] = useInViewOnce(`scout:${data.pitcher.id}:${data.hitter.id}:meetings`)
  const failed = !h2h.loading && h2h.data === null
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  // No pitch tracking before 2008 (slice 7b): Savant may still list the plate
  // appearances, with no pitches. A pair with none tracked, and a player who
  // left before then, gets the Stats API career line.
  const early = !h2h.loading && h2h.data?.pas.every((pa) => !pa.pitches) && [data.hitter, data.pitcher].some((p) => p.lastYear && p.lastYear < '2008')
  const total = useAsync(() => (early ? fetchVsPlayerTotal(data.hitter.id, data.pitcher.id) : Promise.resolve(null)), [early, data])

  let body
  if (h2h.loading) body = <AsyncStatus loading hasData={false} />
  else if (failed) body = <EmptyState>No head-to-head on file</EmptyState>
  else if (early && total.loading) body = <AsyncStatus loading hasData={false} />
  else if (early && total.data) {
    const t = total.data
    body = (
      <>
        <p className="scout__note">Regular season · no pitch tracking before 2008</p>
        <p className="scout__note">
          {t.pa} PA · AVG/OBP/SLG {t.avg}/{t.obp}/{t.slg} · {t.hr} HR · {t.k} K · {t.bb} BB
        </p>
      </>
    )
  } else if (pas.length === 0) body = <EmptyState>No meetings before {humanDateWithYear(cutoff)}</EmptyState>
  else {
    const f = meetingFacts(pas)
    const t = totalsOf(pas)
    const mix = mixRows(pas, board)
    const years = [...new Set(pas.map((pa) => pa.date.slice(0, 4)))]
    const note = board ? unseenNote(mix, names, crowd, years) : null
    const seen = mix.filter((r) => r.meet > 0)
    const sentence = [seen.length > 0 && `${seen.map((r) => `${r.name} ${r.meet}%`).join(' · ')}.`, note].filter(Boolean).join(' ')
    body = (
      <>
        <h2 className="scout__meethead">Past meetings</h2>
        <div className="scout__meet">
          <Stack gap="base" className="scout__meetside">
            <MeetingFacts
              f={f}
              kbb={`${t.k} · ${t.bb}`}
              slash={[t.avg, t.obp, t.slg].map(rate3).join('/')}
            />
            {board && f.pitches > 0 && (
              <div className="scout__mix">
                <h3 className="scout__mixhead">What {names.hitter} saw</h3>
                <span className="scout__mixlabel">Meetings</span>
                <MixBar rows={mix} pick={(r) => r.meet} label="Meetings" />
                <span className="scout__mixlabel">{data.season} to {stance === 'L' ? 'LHH' : 'RHH'}</span>
                <MixBar rows={mix} pick={(r) => r.season} label={`${data.season} to ${crowd}`} />
                <span className="scout__mixkey">
                  {mix.map((r) => (
                    <span key={r.code} className="scout__mixkeyitem"><Mark code={r.code} />{r.name}</span>
                  ))}
                </span>
                {sentence && <p className="scout__note scout__mixnote">{sentence}</p>}
              </div>
            )}
          </Stack>

          <Stack gap="base" className="scout__games">
            {games.map((g) => (
              <Stack gap="snug" key={g.gamePk} className="scout__game">
                <p className="scout__gamehead">
                  <span>{monthDayName(g.date)}, {g.date.slice(0, 4)}</span>
                  <span className="scout__gamelabel">{g.tag || g.label} · {g.pas.length} PA</span>
                </p>
                {/* Grid: three cards across on a desktop (about 250px each), one on a phone. */}
                <Grid min={250} gap="base" className="scout__pas">
                  {g.pas.map((pa) => {
                    const list = pa.pitchList ?? []
                    const last = list.at(-1)
                    return (
                      <Stack gap="snug" as="article" key={pa.key} className="scout__pa" style={{ '--i': Math.min(pas.indexOf(pa), 6) }}>
                        <div className="scout__pagrid">
                        <div className="scout__pacell">
                          <span className="scout__painn">
                            {pa.inning ? meetingOrdinal(pa.inning) : 'PA'}
                            {pa.inning && <span className="scout__painnx"> inning</span>}
                          </span>
                          <span className="scout__padiamond">
                            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><polygon points="24,4 44,24 24,44 4,24" /></svg>
                            <span className="scout__pamark">{scoringMark(pa)}</span>
                          </span>
                          <span className="scout__paresult">{resultWord(pa)}</span>
                        </div>
                        <Stack gap="snug" className="scout__pabody">
                          {list.length ? (
                            <ol className="scout__pitches">
                              {list.map((p, i) => {
                                const call = callOf(p.call)
                                const name = nameOf(p.code, board)
                                return (
                                  <li key={p.n ?? i}>
                                    <button
                                      type="button"
                                      className="scout__pbtn"
                                      aria-label={`Pitch ${i + 1}: ${name}, ${fixed(p.mph, 1)} mph, ${call.word}`}
                                      onClick={() => setOpen(walk.findIndex((w) => w.pa === pa && w.k === i + 1))}
                                    >
                                      <span className="scout__pbtnn">{i + 1}</span>
                                      <span>
                                        <span className="scout__pbtnname"><Mark code={p.code} />{name} · {fixed(p.mph, 1)} mph</span>
                                        <span className="scout__pbtnsub">Count {p.balls}-{p.strikes}</span>
                                      </span>
                                      <span className="scout__pbtncall" data-tone={call.tone}>{call.word}</span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ol>
                          ) : (
                            <p className="scout__note">No tracked pitches.</p>
                          )}
                          {last && inPlay(last) && <ContactLine pitch={last} />}
                          {pa.description && <p className="scout__play">{playText(pa.description, data.hitter.name, data.hitter.last)}</p>}
                        </Stack>
                        </div>
                      </Stack>
                    )
                  })}
                </Grid>
              </Stack>
            ))}
          </Stack>
        </div>
      </>
    )
  }

  return (
    <section className="scout__panel" aria-label="Meetings" ref={ref} data-motion={phase}>
      {body}
      {open != null && walk[open] && (
        <PitchModal
          walk={walk}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          board={board}
          data={data}
          view={view}
          stance={hitterStance}
          cutoff={cutoff}
        />
      )}
    </section>
  )
}
