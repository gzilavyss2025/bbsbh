import { contrastRatio } from '../../../../lib/contrast.js'
import { HEADER_CONTRAST_MIN } from '../../../../lib/identity/fields.js'
import { identityGroups, treatmentLabel, treatmentsForClub } from './identityFields.js'
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

// Colour boxes get a native swatch beside the text, but only when the value
// parses as a hex — the stores also carry `rgba(...)` strings, which
// `<input type="color">` cannot represent and would silently rewrite.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

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

export function IdentityDrawer({ teamId, isMilb, draft }) {
  const treatments = treatmentsForClub(teamId, isMilb)
  // The strip's selection, defaulting to the first tile this club has rather
  // than assuming Main — a MiLB affiliate has no Main.
  const treatment = treatments.includes(draft.treatment) ? draft.treatment : treatments[0]
  const groups = identityGroups(teamId, { isMilb, treatment })

  return (
    <div className="iddrawer">
      <div className="iddrawer__strip" role="group" aria-label="Which jersey to tune">
        {treatments.map((key) => (
          <button
            key={key}
            type="button"
            className={`iddrawer__tile${key === treatment ? ' is-selected' : ''}`}
            aria-pressed={key === treatment}
            onClick={() => draft.setTreatment(key)}
          >
            {treatmentLabel(key)}
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
        </section>
      ))}

      <p className="iddrawer__foot">
        An empty box means &ldquo;use what ships&rdquo;. A club&apos;s researched extras, its logo
        art and the recolour library stay in <span className="mono">/identity-lab</span>, which can
        show thirty clubs at once — this drawer only holds what this page can show you.
      </p>
    </div>
  )
}
