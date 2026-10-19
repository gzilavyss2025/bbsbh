import { useEffect, useId, useRef } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Table } from '../../../../../components/ui/table/Table.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { humanDateWithYear } from '../../../../../lib/dates.js'
import { useLinkScope, useRouteLink } from '../../../../../lib/nav.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { gamePath, linkQuery } from '../../../../../lib/route.js'
import { DASH, Fact } from '../../../parts.jsx'
import { loadStart, resultOf, startDetail } from './gameDetail.js'

// The game detail view (#1851): one row of the Game Log, opened. A native modal <dialog>:
// showModal() makes the page behind it inert (the focus trap) and Escape fires `cancel`.
// The caller hands focus back to the row. The feed and the clips load only when it opens.
// Score and decision come from the row, so a game still on shows neither, and no clip (gameDetail.js).

function Plays({ title, plays }) {
  if (!plays.length) return null
  return (
    <Stack gap="tight" as="section">
      <h3 className="pitchlog__h">
        {title} <span className="mono">({plays.length})</span>
      </h3>
      <ul className="pitchlog__plays">
        {plays.map((p, i) => (
          <li key={p.key ?? i}>
            <Cluster gap="tight" align="center">
              <span className="mono pitchlog__inn">Inn {p.inning ?? DASH}</span>
              <b>{p.batter}</b>
              {p.event && <span>{p.event}</span>}
              {p.clip && (
                <Door href={p.clip.href} target="_blank" rel="noreferrer" className="pitchlog__clip">
                  {p.clip.label}
                </Door>
              )}
            </Cluster>
            <p className="hint">{p.text}</p>
          </li>
        ))}
      </ul>
    </Stack>
  )
}

export function StartDetail({ row, pitcherId, last, onEarlier, onLater, onClose }) {
  const ref = useRef(null)
  const titleId = useId()
  const link = useRouteLink()
  const { asOf, sportId } = useLinkScope()
  const { data, loading } = useAsync(() => loadStart(row), [row.gamePk])
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const close = () => {
    ref.current?.close()
    onClose()
  }

  const d = data && startDetail(data, pitcherId, row)
  const playClips = d && [...d.strikeouts, ...d.bigPlays].some((p) => p.clip)
  const res = resultOf(row, last)
  const [away, home] = row.home ? [row.oppAbbr, row.clubAbbr] : [row.clubAbbr, row.oppAbbr]
  const head = [`Game ${row.n} of ${row.of}`, row.series || 'Regular season', row.relief && 'Relief', `${row.home ? 'vs' : 'at'} ${row.opp}`, humanDateWithYear(row.day)]

  return (
    <dialog
      ref={ref}
      className="scrim scrim--center pitchlog__dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <Stack className="sheet pitchlog__detail">
        <Cluster align="center" className="pitchlog__top">
          <h2 id={titleId} className="sheet__title pitchlog__title">
            {head.filter(Boolean).join(' · ')}
          </h2>
          <Button size="control" onClick={close}>
            Close
          </Button>
        </Cluster>

        {res ? (
          <div className={`pitchlog__result pitchlog__result--${row.result}`}>
            <b className="pitchlog__verdict">{res.label}</b> <span className="mono">{res.score}</span>
            {res.dec && <p>{res.dec}</p>}
          </div>
        ) : (
          <p className="hint">No final score on file. A game played today shows no score and no clips until the next day.</p>
        )}

        <FactGrid look="strip" as="div">
          <Fact label="IP" value={row.ip} mono />
          <Fact label="H" value={row.h} mono />
          <Fact label="R" value={row.r} mono />
          <Fact label="ER" value={row.er} mono />
          <Fact label="BB" value={row.bb} mono />
          <Fact label="K" value={row.k} mono />
          <Fact label="HR" value={row.hr} mono />
          <Fact label="Pitches" value={row.pitches == null ? DASH : `${row.pitches}${row.strikes == null ? '' : ` (${row.strikes} strikes)`}`} mono />
        </FactGrid>

        {loading || !d ? (
          <p className="hint pitchlog__wait" aria-busy="true">
            Loading the game…
          </p>
        ) : !data.feed ? (
          <p className="hint">The play by play did not load. Close and open the game to try again.</p>
        ) : (
          <>
            {d.pitches.length > 0 ? (
              <Table frame="bare" className="pitchlog__pitches">
                <caption className="sr-only">Pitches in this game</caption>
                <thead>
                  <tr>
                    <th scope="col">Pitch</th>
                    <th scope="col">Used</th>
                    <th scope="col">Share</th>
                    <th scope="col">Avg mph</th>
                    <th scope="col">Whiffs</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pitches.map((p) => (
                    <tr key={p.code}>
                      <th scope="row">
                        <span className="pitchlog__swatch" style={{ background: pitchMark(p.code).color }} aria-hidden="true" /> {pitchMark(p.code).name}
                      </th>
                      <td className="mono">{p.n}</td>
                      <td className="mono">{p.pct}%</td>
                      <td className="mono">{p.mph ?? DASH}</td>
                      <td className="mono">{p.whiffs}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="hint">No pitch tracking for this game.</p>
            )}

            {row.result && (
              <Stack gap="tight" as="section">
                <h3 className="pitchlog__h">Game clips</h3>
                {d.clips.length > 0 ? (
                  <ul className="pitchlog__plays">
                    {d.clips.map((c) => (
                      <li key={c.key}>
                        <Cluster gap="tight" align="center">
                          <span>{c.title}</span>
                          <Door href={c.href} target="_blank" rel="noreferrer" className="pitchlog__clip">
                            {c.label}
                          </Door>
                        </Cluster>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">MLB posted no clips about his outing.{playClips && ' The plays below link to single-pitch clips.'}</p>
                )}
              </Stack>
            )}
            <Plays title="Strikeouts" plays={d.strikeouts} />
            <Plays title="Big plays against him" plays={d.bigPlays} />
            {playClips && (
              <p className="hint">
                Clips come from MLB&apos;s highlight reel for the game. If MLB cut no highlight for a play, the button opens the single-pitch clip from Baseball Savant.
              </p>
            )}
          </>
        )}

        <Cluster align="center" className="pitchlog__nav">
          <Button size="control" onClick={onEarlier} disabled={!onEarlier}>
            Earlier game
          </Button>
          <Button size="control" onClick={onLater} disabled={!onLater}>
            Later game
          </Button>
          <Door {...link(gamePath(row.day, away, home, 'boxscore', row.gameNumber) + linkQuery({ d: asOf, s: sportId }))}>Open this game</Door>
        </Cluster>
      </Stack>
    </dialog>
  )
}
