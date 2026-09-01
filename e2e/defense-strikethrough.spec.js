import { test, expect } from './fixtures.js'

// The rendered half of the strike-through invariant that
// scripts/check-strike-links.mjs guards in the stylesheet.
//
// The bug this pins: a replaced fielder's surname in the defense diamond is a
// PlayerLink — a <button class="plink"> — and `.plink` sets
// `text-decoration: none`, so `.defdiamond__name--out`'s line-through never
// reached the name. Site-wide, on every viewport. It only LOOKED like it worked
// on some entries, because a substitute also carries an un-linked " (6th)" tag
// beside his name and the line did land on that.
//
// THE MECHANISM CHANGED; THE INVARIANT DID NOT (issue #981, Route A). The
// strike is no longer `text-decoration: line-through` — that cannot animate, so
// it is a graphite bar drawn as an `::after` on the WRAPPER
// (styles/motion/strike.css). That is what makes the original bug structurally
// impossible rather than merely guarded: a bar over the wrapper spans whatever
// the wrapper holds, so it covers a link, an inning tag or a bare name without
// having to know which it got.
//
// So this asserts the same three facts against the bar — a replaced starter is
// struck, a replaced substitute is struck, the standing occupant is not — plus
// the one the old mechanism could not state at all: that the mark actually
// reaches ACROSS THE LINK, which is the exact span that used to be missed.
//
// The check is on computed style rather than a real game because a diamond with
// a replaced fielder needs a specific mid-game defensive substitution to exist
// in a live feed. What is asserted here is exactly what the CSS owes the
// component: DefenseName's own markup contract (which classes it applies to
// which entry) lives in DefenseDiamond.jsx and is mirrored below.
const DIAMOND_MARKUP = `
  <div class="defdiamond" data-strike-probe>
    <div class="defdiamond__field">
      <span class="defdiamond__spot">
        <span class="defdiamond__name defdiamond__name--in" id="probe-in">
          <button type="button" class="plink">MITCHELL</button>
          <span class="defdiamond__enter"> (7th)</span>
        </span>
        <span class="defdiamond__name defdiamond__name--out" id="probe-out-sub">
          <button type="button" class="plink">BAUERS</button>
          <span class="defdiamond__enter"> (6th)</span>
        </span>
        <span class="defdiamond__name defdiamond__name--out" id="probe-out-starter">
          <button type="button" class="plink">FRELICK</button>
        </span>
        <span class="defdiamond__num">8</span>
      </span>
    </div>
  </div>
`

test.describe('defense diamond strike-through', () => {
  test('crosses out a replaced fielder, link and all', async ({ page }) => {
    // Any route serves the app's full stylesheet; the slate is the cheapest.
    await page.goto('/')
    await page.waitForSelector('#root')

    const styles = await page.evaluate((markup) => {
      const host = document.createElement('div')
      host.innerHTML = markup
      document.body.appendChild(host)
      const read = (id) => {
        const wrap = document.getElementById(id)
        const link = wrap.querySelector('.plink')
        const bar = getComputedStyle(wrap, '::after')
        const wrapBox = wrap.getBoundingClientRect()
        const linkBox = link.getBoundingClientRect()
        return {
          // Drawn at all, and not scaled away to nothing.
          drawn: bar.content !== 'none' && bar.transform !== 'matrix(0, 0, 0, 1, 0, 0)',
          height: parseFloat(bar.height) || 0,
          // The bar is laid across the WHOLE wrapper, so it necessarily crosses
          // the link — the span the old decoration could not reach.
          coversLink: wrapBox.left <= linkBox.left + 1 && wrapBox.right >= linkBox.right - 1,
        }
      }
      const out = {
        starter: read('probe-out-starter'),
        sub: read('probe-out-sub'),
        standing: read('probe-in'),
      }
      host.remove()
      return out
    }, DIAMOND_MARKUP)

    // The replaced starter — no inning tag, so the link is the whole entry. This
    // is the case that drew no line at all.
    expect(styles.starter.drawn).toBe(true)
    expect(styles.starter.height).toBeGreaterThan(0)
    expect(styles.starter.coversLink).toBe(true)

    // A replaced substitute — the case that half-worked, striking the tag only.
    expect(styles.sub.drawn).toBe(true)
    expect(styles.sub.height).toBeGreaterThan(0)
    expect(styles.sub.coversLink).toBe(true)

    // The standing occupant is never struck; he's inked seam-red instead.
    expect(styles.standing.drawn).toBe(false)
  })
})
