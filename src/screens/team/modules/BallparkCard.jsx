import { rankedDimensions } from '../../../lib/ballpark/ballparkData.js'
import { ballparkLogoUrl, ballparkPhoto, creditLine, venueKey } from '../../../lib/ballpark/ballparkArt.js'
import { useCopy } from '../../../copy/copyContext.js'
import { BallparkDiagram } from '../../../components/ballpark/BallparkDiagram.jsx'
import { Facts, RankGroup } from '../../../components/ballpark/BallparkFacts.jsx'

// The Overview's Ballpark card. Two stacked rows: a HERO (a photograph of the
// place beside its name) over the DETAILS (the field diagram beside the facts,
// the note, and the ranked dimensions). Both rows collapse to a single column
// below 740px — the app's one responsive breakpoint, src/CLAUDE.md.
//
// Same underlying content as the lineup page's BallparkModal, laid out inline
// rather than behind a tap: this IS the full detail view here, not a preview.
//
// Spoiler-safe and free the whole way down. Park geometry carries no score, the
// photo is a building, and the note is admin-typed prose about that building —
// nothing here is derived from a game. `team.venue.name` comes from the weekly
// static snapshot (gen-teams.mjs), so there is no live fetch either. Renders
// nothing for a park not on file, the same graceful-degrade convention as
// ballparkFor — which is every MiLB park.
export function BallparkCard({ team }) {
  const { t } = useCopy()
  const venueName = team.venue?.name
  const park = venueName ? rankedDimensions(venueName) : null
  if (!park) return null

  const distRows = park.rows.filter((r) => r.group === 'dist')
  const wallRows = park.rows.filter((r) => r.group === 'wall')

  // Art is looked up by the park's CANONICAL name, never the raw feed string,
  // so a renamed venue resolves through its alias to the one shared record.
  const photo = ballparkPhoto(park.name)
  const logo = ballparkLogoUrl(park.name)
  // Empty until the owner writes one in /admin — most parks have no note, and a
  // card with an empty paragraph in it looks broken rather than unwritten.
  const note = t(`ballpark.${venueKey(park.name)}`)

  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Ballpark</span>
      </div>
      <div className="thub-card__body">
        <div className="ballparkcard__hero">
          {photo && (
            <figure className="ballparkcard__photoWrap">
              <img
                className="ballparkcard__photo"
                src={photo.src}
                alt={`${park.name}, seen from the stands`}
                loading="lazy"
                decoding="async"
              />
              {/* Not decoration — CC BY / CC BY-SA oblige us to name the
                  photographer wherever the photo appears. See ballparkArt.js. */}
              <figcaption className="ballparkcard__credit">
                <a href={photo.credit.source} target="_blank" rel="noreferrer noopener">
                  {creditLine(photo.credit)}
                </a>
              </figcaption>
            </figure>
          )}
          <div className="ballparkcard__title">
            {logo ? (
              <img className="ballparkcard__logo" src={logo} alt={park.name} loading="lazy" />
            ) : (
              <p className="ballparkcard__name">{park.name}</p>
            )}
          </div>
        </div>

        <div className="ballparkcard__layout">
          <BallparkDiagram
            className="ballparkcard__diagram"
            dist={park.dist}
            wall={park.wall}
            arc={park.arc}
          />
          <div className="ballparkcard__details">
            <dl className="bpsheet__facts">
              <Facts label="Opened" value={park.built} />
              <Facts label="Roof" value={park.roof} />
              <Facts label="Capacity" value={park.capacity?.toLocaleString()} />
            </dl>
            {note && <p className="ballparkcard__note">{note}</p>}
            <div className="bpsheet__ranks">
              <RankGroup title="Outfield distances" rows={distRows} />
              <RankGroup title="Wall heights" rows={wallRows} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
