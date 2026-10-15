import fs from 'node:fs'
const NAMES = {
  Season: 'Season statistics (batter): a scope switch, five stat tiles and a year-by-year table.',
  Splits: 'Splits (batter): the split boards, each a small stamped table or chart.',
  PlateApproach: 'Plate approach (batter): the zone map and the swing and take tables.',
  Contact: 'Contact (batter): the spray chart, the player stepper and the batted-ball mix.',
  FormTrend: 'Form trend (batter): the recent-form chart.',
  PitchArsenal: 'Pitch arsenal (pitcher): the mix bar, the pitch cards and the flight scene.',
  OnTheMound: 'On the mound (pitcher): days since his last start and the last ten outings.',
}
const ORIGIN = process.env.IMG_ORIGIN || 'https://bbsbh.vercel.app'
for (const [name, blurb] of Object.entries(NAMES)) {
  const f = `.design-sync/captures/${name}.json`
  if (!fs.existsSync(f)) { console.log('missing', name); continue }
  const { html, css, chain } = JSON.parse(fs.readFileSync(f, 'utf8'))
  const open = chain.map((c) => `<${c.tag} class="${c.cls}">`).join('\n')
  const close = chain.map((c) => `</${c.tag}>`).reverse().join('\n')
  const body = html.replaceAll('http://localhost:5173', ORIGIN)
  const dir = `${process.env.DS_OUT || 'ds-bundle'}/components/Player/${name}`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(`${dir}/${name}.html`, `<!-- @dsCard group="Player cards" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<link rel="stylesheet" href="../../../styles.css">
<style>
/* ${blurb}
   A static capture of the real card from the app (a batter or pitcher on /player/{id}), with the real
   CSS rules that match inside it, copied from src/styles/player-next/. The figures are that player's
   real figures on the day of capture. Interactions are not wired: it is a picture of the card. */
${css}
</style>
</head>
<body>
<div id="root">
${open}
${body}
${close}
</div>
</body>
</html>
`)
  console.log(name, fs.statSync(`${dir}/${name}.html`).size)
}
