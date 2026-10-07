import { useMemo, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { fetchHeadToHead, totalsOf } from '../../../api/scout/headToHead.js'
import { rate3 } from '../../../api/person/shared.js'
import { pitchFamily } from '../../../api/pitchArsenal.js'
import { humanDateWithYear, monthDayYear } from '../../../lib/dates.js'
import { ROUND_TAG, resultShort } from '../../../lib/scout/format.js'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { AsyncStatus } from '../../../components/ui/AsyncGate.jsx'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { AsOfBanner } from '../../../components/seal/AsOfBanner.jsx'
import { callOf, gamesOf, inPlay, meetingFacts, mixRows, nameOf, ordinal, pitchWalk, playText, unseenNote } from './meetings.js'
import { PitchModal } from './PitchModal.jsx'
import { ContactFacts, Fact, fixed, xw } from './Facts.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

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
// inclusive. `AsOfBanner` is the way to move it. The film lookup refuses the
// same games (api/scout/playIds.js).
//
// Scope filters the plate appearances by round, and every figure here is
// rebuilt from the same rows, so the facts and the list cannot disagree.
function MixBar({ rows, pick }) {
  return (
    <span className="scout__mixbar">
      {rows.filter((r) => pick(r) > 0).map((r) => (
        <span key={r.code} className="scout__mixseg" data-family={r.family} data-shade={Math.min(r.shade, 2)} style={{ width: `${pick(r)}%` }}>
          {/* "Fastball 58%" when wide, "17%" when narrow, nothing when tiny.
              The warm grey "other" segment never takes a label: no ink on it
              holds AA (lib/design/contrastPairings.js). */}
          {r.family === 'other' ? '' : pick(r) >= 30 ? `${r.name} ${pick(r)}%` : pick(r) >= 9 ? `${pick(r)}%` : ''}
        </span>
      ))}
    </span>
  )
}

export function MeetingsPanel({ data, board, cutoff, asOf, scope, view, stance, hitterStance }) {
  const h2h = useAsync(() => fetchHeadToHead(data.hitter.id, data.pitcher.id, cutoff), [data.hitter.id, data.pitcher.id, cutoff])
  const pas = useMemo(
    () => (h2h.data?.pas ?? []).filter((r) => scope === 'all' || (scope === 'reg') === (r.round === 'R')),
    [h2h.data, scope],
  )
  const games = useMemo(() => gamesOf(pas), [pas])
  const walk = useMemo(() => pitchWalk(games), [games])
  const [open, setOpen] = useState(null)
  const failed = !h2h.loading && h2h.data === null
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  const crowd = stance === 'L' ? 'lefties' : 'righties'

  let body
  if (h2h.loading) body = <AsyncStatus loading hasData={false} />
  else if (failed) body = <EmptyState>No head-to-head on file</EmptyState>
  else if (pas.length === 0) body = <EmptyState>No meetings before {humanDateWithYear(cutoff)}</EmptyState>
  else {
    const f = meetingFacts(pas)
    const t = totalsOf(pas)
    const mix = mixRows(pas, board)
    const years = [...new Set(pas.map((pa) => pa.date.slice(0, 4)))]
    const note = board ? unseenNote(mix, names, crowd, years) : null
    body = (
      <>
        <div className="scout__facts">
          <Fact value={`${f.h}-for-${f.ab}`} sub={`${f.pa} PA`} label="Hits" />
          <Fact value={f.pitches} label="Pitches" />
          <Fact value={fixed(f.avgExit, 1)} unit="mph" label="Avg exit velocity" />
          <Fact value={xw(f.xwobaContact)} label="xwOBA on contact" />
        </div>
        <p className="scout__note">
          AVG/OBP/SLG {[t.avg, t.obp, t.slg].map(rate3).join('/')} · {t.hr} HR · {t.k} K · {t.bb} BB
        </p>

        {board && f.pitches > 0 && (
          <div className="scout__mix">
            <span className="scout__mixlabel">In the {games.length === 1 && pas.length > 0 ? 'meeting' : 'meetings'}</span>
            <MixBar rows={mix} pick={(r) => r.meet} />
            <span className="scout__mixlabel">{data.season} to {stance === 'L' ? 'LHH' : 'RHH'}</span>
            <MixBar rows={mix} pick={(r) => r.season} />
            <span className="scout__mixkey">
              {mix.map((r) => (
                <span key={r.code} className="scout__mixkeyitem" data-family={r.family} data-shade={Math.min(r.shade, 2)}>{r.name}</span>
              ))}
            </span>
            {note && <p className="scout__note scout__mixnote">{note}</p>}
          </div>
        )}

        {games.map((g) => (
          <Stack gap="snug" key={g.gamePk} className="scout__game">
            <p className="scout__gamehead">
              <span>{monthDayYear(g.date)}</span>
              <Pill>{ROUND_TAG[g.round] ?? g.round}</Pill>
            </p>
            {g.pas.map((pa) => {
              const list = pa.pitchList ?? []
              const last = list.at(-1)
              return (
                <Stack gap="snug" as="article" key={pa.key} className="scout__pa">
                  <header className="scout__pahead">
                    <span className="scout__patitle">{pa.inning ? `${ordinal(pa.inning)} inning` : 'Plate appearance'}</span>
                    <span className="scout__pameta">
                      <Pill figure>{resultShort(pa)}</Pill> {list.length} {list.length === 1 ? 'pitch' : 'pitches'}
                    </span>
                  </header>
                  {pa.description && <p className="scout__play">{playText(pa.description, data.hitter.name)}</p>}
                  {last && inPlay(last) && <ContactFacts pitch={last} />}
                  {list.length ? (
                    <div className="scout__pitches">
                      {list.map((p, i) => {
                        const call = callOf(p.call)
                        const name = nameOf(p.code, board)
                        return (
                          <button
                            key={p.n ?? i}
                            type="button"
                            className="scout__pbtn"
                            data-family={pitchFamily(p.code)}
                            aria-label={`Pitch ${i + 1}: ${name}, ${fixed(p.mph, 1)} mph, ${call.word}`}
                            onClick={() => setOpen(walk.findIndex((w) => w.pa === pa && w.k === i + 1))}
                          >
                            <span className="scout__pbtnname">{i + 1}. {name}</span>
                            <span className="scout__pbtnsub">{fixed(p.mph, 1)} mph · {p.balls}-{p.strikes} count</span>
                            <span className="scout__pbtncall" data-tone={call.tone}>{call.word}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="scout__note">No tracked pitches.</p>
                  )}
                </Stack>
              )
            })}
          </Stack>
        ))}
      </>
    )
  }

  return (
    <section className="scout__panel" aria-label="Meetings">
      <AsOfBanner asOf={asOf} />
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
