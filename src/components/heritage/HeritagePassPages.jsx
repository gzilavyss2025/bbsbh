import { useState } from 'react'
import { passPage, passDate, heritagePassModel } from '../../lib/heritage/pass.js'
import { HeritagePass } from './HeritagePass.jsx'
import { heritageArt } from '../../lib/heritage/art.js'
import { Grid } from '../ui/layout/Grid.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Button } from '../ui/control/Button.jsx'

// Receives only the owner's existing book collection, never an arbitrary slate.
// Four tall passes per display page; original book placements remain untouched.
export function HeritagePassPages({ stamps, factsByPk, onOpenGame }) {
  const [page, setPage] = useState(1)
  const { entries, current, pages } = passPage(stamps, page)
  return (
    <Stack gap="loose" className="heritagepasses">
      <Grid as="ul" min="250px" gap="loose" aria-label="Heritage Pass collection">
        {entries.map((entry) => (
          <li key={entry.gamePk}>
            {heritagePassModel(factsByPk[entry.gamePk]) ? <HeritagePass game={factsByPk[entry.gamePk]}
              artwork={heritageArt(factsByPk[entry.gamePk].venue)} /> : (
              <p>{passDate(entry.date)} · Game details not available</p>
            )}
            <Button className="heritagepasses__open" onClick={() => onOpenGame?.(entry.gamePk)}
              aria-label={`Open game, ${passDate(entry.date)}`}>Open game ›</Button>
          </li>
        ))}
      </Grid>
      <Cluster as="nav" className="heritagepasses__nav" aria-label="Heritage Pass pages">
        <Button disabled={current === 1} onClick={() => setPage(current - 1)}>‹ Back</Button>
        <span aria-live="polite">Page {current} of {pages}</span>
        <Button disabled={current === pages} onClick={() => setPage(current + 1)}>Next ›</Button>
      </Cluster>
    </Stack>
  )
}
