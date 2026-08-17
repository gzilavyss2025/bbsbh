import { contrastRatio } from '../../../../lib/contrast.js'
import { HEADER_CONTRAST_MIN } from '../../../../lib/identity/fields.js'
import { TeamTreatmentMark } from '../../../../components/logo/TeamTreatmentMark.jsx'
import { identityGroups, treatmentLabel, treatmentsForClub } from './identityFields.js'
import { IdentityLogoField } from './IdentityLogoField.jsx'
import { IdentityStampPreview } from './IdentityStampPreview.jsx'
import '../../../../styles/62-identity-admin.css'

// The identity drawer, under the team hub's club header.
//
// NOT A MODAL, AND THAT IS THE POINT. Everything it edits — the header's own
// fill and ink, the club's mark and its tile colour, the stamp — is being
// rendered by the page this drawer is attached to, so THE PAGE IS ITS OWN
// PREVIEW. A dialog over the top would hide the only honest preview there is,
// and a mock inside the drawer would be a second render path that agrees with
// the real one right up until it doesn't. That is the strongest argument for
// this placement over a row in /identity-lab, which can only ever show a swatch.
//
// EVERY FIELD'S PLACEHOLDER IS LIVE. `identityGroups` reads the app's own
// resolvers on each render, and the draft is already applied to the overlay's
// preview layer by then — so a box left empty shows what this club would render
// with NO override, and clearing a field shows you the shipped value coming back
// before you save. One render path, no editor-only state.
//
// THE PREVIEWS INSIDE THE DRAWER KEEP THAT RULE. The strip's jersey tiles, the
// Logo art group's big tile and the two stamp previews are the app's OWN
// components (TeamTreatmentMark, GameStamp) reading the app's own resolvers
// through the overlay — never a mock. They exist because three of the things
// this drawer tunes are not otherwise on this page at once: a club has one
// header but six tiles, and no team page renders a stamp.

// Colour boxes get a native swatch beside the text, but only when the value
// parses as a hex — the stores also carry `rgba(...)` strings, which
// `<input type="color">` cannot represent and would silently rewrite.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// The EyeDropper API (Chromium; feature-detected, absent elsewhere) — pick any
// pixel on screen straight into a colour field. Made for this page: the value
// you usually want is already ON it — the club's mark, a photo, the header —
// and reading it by eye off a screenshot is how near-miss hexes happen.
const CAN_EYEDROP = typeof window !== 'undefined' && 'EyeDropper' in window

async function pickFromScreen(id, onChange) {
  try {
    const { sRGBHex } = await new window.EyeDropper().open()
    onChange(id, sRGBHex)
  } catch {
    // Dismissed with Esc — nothing picked, nothing to do.
  }
}

function Field({ field, value, onChange }) {
  const { spec, id, label, landed } = field
  const shown = value ?? ''
  const common = {
    id,
    value: shown,
    onChange: (e) => onChange(id, e.target.value),
  }

  return (
    <label className="iddrawer__field" htmlFor={id}>
      <span className="iddrawer__label">{label}</span>
      {spec.kind === 'pick' ? (
        <select {...common} className="iddrawer__input">
          {/* An empty option is not "none" — it is "whatever this club already
              does", which for these three picks is a real and different answer
              from any treatment name. */}
          <option value="">{landed ? `${treatmentLabel(landed)} (unchanged)` : 'Leave as it is'}</option>
          {spec.values.map((v) => (
            <option key={v} value={v}>
              {treatmentLabel(v)}
            </option>
          ))}
        </select>
      ) : (
        <span className="iddrawer__inputrow">
          <input
            {...common}
            className="iddrawer__input"
            type="text"
            inputMode={spec.kind === 'number' ? 'decimal' : 'text'}
            placeholder={landed || '—'}
            spellCheck="false"
            autoComplete="off"
          />
          {spec.kind === 'color' && (
            <input
              className="iddrawer__swatch"
              type="color"
              aria-label={`${label} colour picker`}
              value={HEX.test(shown) ? shown : HEX.test(landed) ? landed : '#000000'}
              onChange={(e) => onChange(id, e.target.value)}
            />
          )}
          {spec.kind === 'color' && CAN_EYEDROP && (
            <button
              type="button"
              className="iddrawer__eyedrop"
              onClick={() => pickFromScreen(id, onChange)}
              title="Pick this colour from anything on screen"
            >
              {/* A drawn pipette, same no-icon-set convention as the gear. */}
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M19.9 4.1a2.8 2.8 0 0 0-4 0l-2.3 2.3-.9-.9a1 1 0 1 0-1.4 1.4l.9.9-7.5 7.5a1 1 0 0 0-.27.5l-.6 2.9a1 1 0 0 0 1.18 1.18l2.9-.6a1 1 0 0 0 .5-.27l7.5-7.5.9.9a1 1 0 0 0 1.4-1.4l-.9-.9 2.3-2.3a2.8 2.8 0 0 0 0-4ZM7.2 17.9l-1.9.4.4-1.9 7.2-7.2 1.5 1.5Z"
                />
              </svg>
              <span className="sr-only">Pick {label} from the screen</span>
            </button>
          )}
        </span>
      )}
      {spec.kind === 'number' && (
        <span className="iddrawer__hint">
          {spec.min} to {spec.max}
        </span>
      )}
    </label>
  )
}

// The live WCAG readout for a club's bar. Rendered from the group's own fields,
// which already resolve through the overlay, so it moves as the owner types —
// the same number scripts/check-contrast.mjs asserts at lint and the endpoint
// asserts at save. Retune the pair; the threshold does not move.
function ContrastReadout({ fields }) {
  const value = (name) => fields.find((f) => f.name === name)?.landed || ''
  const bar = value('bar')
  const onBar = value('onBar')
  if (!bar || !onBar) {
    return (
      <p className="iddrawer__note">
        A bar needs both a fill and an ink before it is used. Without both, this club keeps the
        app&apos;s default navy chrome.
      </p>
    )
  }
  const ratio = contrastRatio(onBar, bar)
  const ok = ratio >= HEADER_CONTRAST_MIN
  return (
    <p className={`iddrawer__note${ok ? '' : ' iddrawer__note--bad'}`} role="status">
      <span className="mono">{ratio.toFixed(2)}:1</span>{' '}
      {ok
        ? `clears the ${HEADER_CONTRAST_MIN}:1 every club bar here is held to.`
        : `is under the ${HEADER_CONTRAST_MIN}:1 every club bar here is held to. This save will be refused.`}
    </p>
  )
}

export function IdentityDrawer({ teamId, isMilb, name, abbreviation, draft }) {
  const treatments = treatmentsForClub(teamId, isMilb)
  // The strip's selection, defaulting to the first tile this club has rather
  // than assuming Main — a MiLB affiliate has no Main.
  const treatment = treatments.includes(draft.treatment) ? draft.treatment : treatments[0]
  const groups = identityGroups(teamId, { isMilb, treatment })

  return (
    <div className="iddrawer">
      {/* Every jersey as the REAL tile it renders — the same TeamTreatmentMark
          square the slate card and masthead draw, through the same resolver, so
          the strip is the club's whole wardrobe at a glance and every tile
          repaints live as the draft below moves it. */}
      <div className="iddrawer__strip" role="group" aria-label="Which jersey to tune">
        {treatments.map((key) => (
          <button
            key={key}
            type="button"
            className={`iddrawer__tile${key === treatment ? ' is-selected' : ''}`}
            aria-pressed={key === treatment}
            onClick={() => draft.setTreatment(key)}
          >
            <TeamTreatmentMark
              teamId={teamId}
              name={name}
              treatment={isMilb ? undefined : key}
              side={isMilb ? key : undefined}
              size={48}
              block="iddrawer__tilemark"
            />
            <span className="iddrawer__tilelabel">{treatmentLabel(key)}</span>
          </button>
        ))}
      </div>

      {draft.status.error && (
        <p className="iddrawer__error" role="alert">
          {draft.status.error}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="iddrawer__group">
          <h3 className="iddrawer__title">{group.title}</h3>
          {group.warning && <p className="iddrawer__warn">{group.warning}</p>}
          {group.triad && <ContrastReadout fields={group.fields} />}
          {/* The stamp group's controls are judged on real stamps — no team
              page renders one otherwise, so without these the four fields
              below would be the one control here with no visible effect. */}
          {group.key === 'stamp' && (
            <IdentityStampPreview teamId={teamId} name={name} abbreviation={abbreviation} />
          )}
          {group.logo ? (
            <IdentityLogoField
              teamId={teamId}
              name={name}
              isMilb={isMilb}
              treatment={treatment}
              field={group.fields[0]}
              value={draft.values[group.fields[0].id]}
              savedValue={draft.saved[group.fields[0].id]}
              onChange={draft.setValue}
            />
          ) : (
            <div className="iddrawer__fields">
              {group.fields.map((field) => (
                <Field
                  key={field.id}
                  field={field}
                  value={draft.values[field.id]}
                  onChange={draft.setValue}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <p className="iddrawer__foot">
        An empty box means &ldquo;use what ships&rdquo;. A club&apos;s researched extras and the
        recolour library stay in <span className="mono">/identity-lab</span>, which can show thirty
        clubs at once — this drawer holds what this page can show you, and shows you each edit
        before you save it.
      </p>
    </div>
  )
}
