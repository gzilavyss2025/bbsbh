import { useState } from 'react'
import FIXTURES from './fixtures.json' with { type: 'json' }
import { HeritagePass } from '../../components/heritage/HeritagePass.jsx'
import { HeritagePassPages } from '../../components/heritage/HeritagePassPages.jsx'
import { SealBox } from '../../components/SealBox.jsx'
import { Grid } from '../../components/ui/layout/Grid.jsx'
import { Button } from '../../components/ui/control/Button.jsx'

// DEV-only, fixed captured records, no arbitrary game or live schedule fetch.
// See docs/heritage-pass.md for fixture provenance and reproduction.
export function HeritagePreview() {
  const [brokenArt, setBrokenArt] = useState(false)
  const [opened, setOpened] = useState(null)
  const regular = FIXTURES[0].game
  const incomplete = { ...regular, sportId: null, gameType: null, venue: '', date: '', seriesGameNumber: null }
  const examples = [
    { label: 'MLB · Regular season', game: regular },
    { label: 'MLB · Postseason', game: FIXTURES[1].game },
    { label: 'MiLB · Regular season', game: FIXTURES[2].game },
    { label: 'Without stadium artwork', game: regular, artwork: brokenArt ? { src: '/missing-heritage-art.svg' } : null },
    { label: 'Optional metadata omitted', game: incomplete },
  ]
  const stamps = FIXTURES.map(({ game }) => ({ gamePk: game.gamePk, date: game.date }))
  const facts = Object.fromEntries(FIXTURES.map(({ game }) => [game.gamePk, game]))
  return (
    <main className="heritage-preview">
      <h1>Heritage Pass</h1>
      <p>Development preview · Captured game records</p>
      <Grid min="280px" gap="loose">
        {examples.map(({ label, game, artwork }) => (
          <section className="heritage-preview__case" key={label}>
            <h2>{label}</h2>
            <HeritagePass game={game} artwork={artwork} />
            {label === 'Without stadium artwork' && (
              <Button onClick={() => setBrokenArt((v) => !v)} aria-pressed={brokenArt}>Test unavailable artwork</Button>
            )}
          </section>
        ))}
      </Grid>
      <section className="heritage-preview__case">
        <h2>Reveal boundary</h2>
        <SealBox label="Tap to reveal the souvenir">{() => <HeritagePass game={regular} />}</SealBox>
      </section>
      <section className="heritage-preview__case">
        <h2>Passport visual mode</h2>
        <HeritagePassPages stamps={stamps} factsByPk={facts} onOpenGame={setOpened} />
        {opened && <p role="status">Selected game {opened}</p>}
      </section>
    </main>
  )
}
