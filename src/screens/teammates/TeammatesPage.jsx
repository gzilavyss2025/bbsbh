import { useState } from 'react'
import '../../styles/teammates/teammates.css'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { getJson } from '../../api/statsapi.js'
import { loadTeamSeasons } from '../../api/teamSeasons.js'
import { findChain, missingFrom } from '../../lib/teammates/chain.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { SiteSearchModal } from '../../components/chrome/SiteSearch.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Loader } from '../../components/ui/Loader.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'

const MAX_LINKS = 10

// The graph loads here, on the first search, never with the page shell. After that
// the file is memoized (staticJson), so a second search is instant. The middle
// players of a chain have no name in the graph, so one people call names them all.
async function search(a, b) {
  const data = await loadTeamSeasons()
  // staticJson answers an empty fallback on a failed load; that is an error, not "no chain".
  if (!data.teamSeasons.length) throw new Error('team-seasons.json did not load')
  const pair = `${a.id}-${b.id}`
  const absent = missingFrom(data, [a.id, b.id])
  if (absent.length) {
    const who = [a, b].filter((p) => absent.includes(p.id)).map((p) => p.name)
    return { pair, chain: null, absent: who, throughSeason: data.throughSeason, credit: data.credit }
  }
  const chain = findChain(data, a.id, b.id, MAX_LINKS)
  if (!chain) return { pair, chain: null, credit: data.credit }
  const ids = chain.filter((_, i) => i % 2 === 0)
  const names = new Map([[a.id, a.name], [b.id, b.name]])
  const missing = ids.filter((id) => !names.has(id))
  if (missing.length) {
    // The chain is already found: a failed name lookup shows ids, not an error.
    try {
      const res = await getJson(`/api/v1/people?personIds=${missing.join(',')}&fields=people,id,fullName`)
      for (const p of res.people ?? []) names.set(p.id, p.fullName)
    } catch {
      /* fall through to the id labels below */
    }
    for (const id of missing) if (!names.has(id)) names.set(id, `Player ${id}`)
  }
  return { pair, chain, names, credit: data.credit }
}

// "Six degrees of teammates". Two players are teammates when both played in a game for
// the same club in the same season (ADR-0100). History about people, no game and no
// score, so this is an open surface (ADR-0034): no SealBox.
export function TeammatesPage() {
  useDocumentTitle('Six Degrees of Teammates')
  const [picks, setPicks] = useState([null, null])
  const [open, setOpen] = useState(null)
  const [a, b] = picks
  const result = useAsync(() => (a && b ? search(a, b) : Promise.resolve(null)), [a?.id, b?.id])
  // Only the result for the CURRENT pair counts. A re-pick must not show the old
  // chain under the new names, not even for the one render before useAsync resets.
  const current = a && b && result.data?.pair === `${a.id}-${b.id}` ? result.data : null
  const { chain, names, absent, throughSeason, credit } = current ?? {}
  const links = chain ? (chain.length - 1) / 2 : 0

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Six degrees of teammates</h1>
      </header>
      <p className="degrees__blurb">
        Pick two players. Tally finds the shortest chain of teammates between them.
      </p>

      <div className="degrees__pickers">
        {['First player', 'Second player'].map((label, slot) => (
          <Stack gap="tight" key={label}>
            <span className="degrees__label">{label}</span>
            <Button size="control" className="degrees__pickbtn" onClick={() => setOpen(slot)}>
              {picks[slot]?.name || 'Search players'}
            </Button>
          </Stack>
        ))}
      </div>
      {open !== null && (
        <SiteSearchModal
          onClose={() => setOpen(null)}
          pick={{
            label: 'Pick a player',
            placeholder: 'Search players',
            accept: (person) => person.id !== picks[1 - open]?.id,
            onPick: (person) => {
              setPicks((p) => p.map((x, i) => (i === open ? person : x)))
              setOpen(null)
            },
          }}
        />
      )}

      {a && b && result.loading && !current && (
        <Loader size="inline" message="Loading every roster since 1897…" />
      )}
      {a && b && result.error && <Notice tone="error" className="degrees__notice">Couldn’t load the rosters. Try again.</Notice>}
      {absent && (
        <p className="hint">
          {absent.join(' and ')} {absent.length > 1 ? 'are' : 'is'} not in the rosters. They
          include only MLB games{throughSeason ? ` through ${throughSeason}` : ''}.
        </p>
      )}
      {current && !chain && !absent && <p className="hint">No chain found within {MAX_LINKS} links.</p>}
      {chain && (
        <section aria-label="Chain of teammates">
          <ol className="degrees__chain">
            {chain.map((step, i) =>
              i % 2 ? (
                <li key={i} className="degrees__link" aria-label={`teammates on the ${step}`}>
                  <b className="degrees__chip">{step}</b>
                </li>
              ) : (
                <Card as="li" key={i} body="flush" className="degrees__player">
                  <PlayerLink id={step} name={names.get(step)} className="degrees__who">
                    <Headshot personId={step} name={names.get(step)} className="degrees__shot" />
                    <span className="degrees__name">{names.get(step)}</span>
                  </PlayerLink>
                </Card>
              ),
            )}
          </ol>
          <p className="degrees__caption">{links === 1 ? '1 link' : `${links} links`}</p>
        </section>
      )}
      {credit?.map((line) => (
        <p key={line} className="hint degrees__credit">
          {line}
        </p>
      ))}
      <ReportFooter />
    </div>
  )
}
