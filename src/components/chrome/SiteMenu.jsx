import { Suspense, useEffect, useRef, useState } from 'react'
import { lazyNamed } from '../../lib/react/lazyNamed.js'
import { useNav, useRouteLink } from '../../lib/nav.js'
import { MENU_GROUPS, isGuidePath } from '../../lib/reportPages.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { DirectoryHeading } from './DirectoryHeading.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { Card } from '../ui/frame/Card.jsx'

// AdminMenuLink.jsx imports @clerk/clerk-react at its top, so it is only
// dynamically imported — and only then does that SDK reach a device — when a
// deploy actually configures Clerk. Same arrangement SiteHeader uses for
// AccountButton, for the same reason. It renders null for everyone who is not
// a signed-in admin, so mounting it unconditionally below is safe.
const AdminMenuLink = isClerkEnabled
  ? lazyNamed(() => import('../account/AdminMenuLink.jsx'), 'AdminMenuLink')
  : null

// A persistent icon button, sibling to SiteSearchButton, that opens a sheet
// listing the app's standalone pages — grouped now, not one flat run of
// nineteen. Lives in SiteHeader (every screen except the slate) and the
// slate's own topbar (see GameSelect), to the right of the search trigger.
//
// MENU_GROUPS is the shared registry in lib/reportPages.js, the same module
// the three footers flatten into REPORT_PAGES; scripts/check-report-pages.mjs
// fails lint if this file stops importing from it.
//
// Four things here are load-bearing, and were all broken together before:
//
// 1. **The list scrolls.** It never did. `.sheet` sets no max-height and no
//    overflow and docks to the bottom of a fixed scrim, so nineteen rows
//    (~860 CSS px) overran a phone and the overflow ran off the TOP of the
//    viewport, where no gesture can reach it. `.sitemenusheet` now caps its
//    own height and scrolls the list inside it.
// 2. **It is a native modal <dialog>.** showModal() puts it in the top layer,
//    so no ancestor can clip or resize it (on iOS the old fixed scrim showed
//    only the "Everything" footer under the status bar), makes the page behind
//    inert, closes on Escape, and hands focus back to the trigger. It stays
//    inside #root, so the ALL-CAPS rule still reaches it. Same pattern as
//    StartDetail.jsx.
// 3. **Rows are anchors, not buttons.** They were `<button onClick={…}>`, so
//    middle-click, cmd-click and "open in new tab" all did nothing. See
//    useRouteLink in lib/nav.js, which keeps a plain click a client-side push.
// 4. **The guides are in it.** Eleven server-rendered pages at /learn
//    (ADR-0053) that nothing inside the app has ever linked to.
export function SiteMenuButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`btn btn--ghost sitebar__menu ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Site menu"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MenuGlyph />
      </button>
      {open && <SiteMenuModal onClose={() => setOpen(false)} />}
    </>
  )
}

function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SiteMenuModal({ onClose }) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // close() hands focus back to the trigger before React unmounts the dialog.
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="scrim scrim--site-menu"
      aria-label="Site menu"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === dialogRef.current && close()}
    >
      <div className="sheet sitemenusheet">
        <div className="sitemenusheet__head">
          <div>
            <p className="sitemenusheet__note">Tally Baseball</p>
            <h2 className="sheet__title">Site menu</h2>
          </div>
          <IconButton onClick={close} label="Close">
            ✕
          </IconButton>
        </div>

        <div className="sitemenusheet__scroll">
          {MENU_GROUPS.map((group) => (
            <Card key={group.id} body="flush" className="sitemenusheet__group">
              <DirectoryHeading group={group} as="h3" />
              <ul className="navdir__list">
                {group.pages.map((item) => {
                  const props = linkProps(item.path)
                  return (
                    <li key={item.path}>
                      <a
                        className="dirlink sitemenusheet__item"
                        href={props.href}
                        onClick={(event) => {
                          props.onClick(event)
                          // A guide link is left to the browser, which unmounts
                          // this sheet on its own; close only when we handled it.
                          if (event.defaultPrevented) close()
                        }}
                      >
                        {item.label}
                        {/* Says the row leaves the app for a server-rendered
                            document — the same tag /more puts on the same rows,
                            and visible text rather than a title= tooltip, which
                            is invisible on the phone this app is built for. */}
                        {isGuidePath(item.path) && <span className="dirtag">Guide</span>}
                      </a>
                    </li>
                  )
                })}
                {/* The admin row rides the last group's list ("The site"),
                    which is already where the site's own pages live. It is not
                    a MENU_GROUPS entry: that registry also feeds both footers
                    and /more, none of which is role-aware, so an entry there
                    would print /admin for every visitor. See AdminMenuLink. */}
                {AdminMenuLink && group.id === MENU_GROUPS[MENU_GROUPS.length - 1].id && (
                  <Suspense fallback={null}>
                    <AdminMenuLink onNavigate={close} />
                  </Suspense>
                )}
              </ul>
            </Card>
          ))}
        </div>

        <div className="sitemenusheet__foot">
          <button
            type="button"
            className="navdir__everything"
            onClick={() => {
              close()
              navigate('/more')
            }}
          >
            Everything, on one page
          </button>
        </div>
      </div>
    </dialog>
  )
}
