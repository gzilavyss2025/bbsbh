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

// The groups the sheet lays out as cards. "Yours" rides above the find box as
// a row of buttons, and Guides and The site sit in the foot's trail, so the
// cards are the report pages alone.
const YOURS = MENU_GROUPS.find((g) => g.id === 'yours')
const TRAIL = MENU_GROUPS.filter((g) => g.id === 'guides' || g.id === 'tools')
const CARDS = MENU_GROUPS.filter((g) => g !== YOURS && !TRAIL.includes(g))
const WIDE = '(min-width: 740px)'

// What the find box matches: the name, its description, its keywords and a
// renamed page's old name. Lower-cased once.
const haystack = (page) => [page.label, page.desc, page.keywords, page.was].filter(Boolean).join(' ').toLowerCase() // caps-js-exempt: case-folds a search match, renders nothing

function useWide() {
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

function SiteMenuModal({ onClose }) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const dialogRef = useRef(null)
  const listRef = useRef(null)
  const wide = useWide()
  const [query, setQuery] = useState('')
  // A phone folds every card but the first two; the reader's own taps win.
  const [folded, setFolded] = useState({})

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Every way out (Escape, back gesture, a row, the backdrop) ends in the
  // dialog's own `close` event, which is the one place React hears about it.
  const close = () => dialogRef.current?.close()

  const term = query.trim().toLowerCase() // caps-js-exempt: case-folds a search match, renders nothing
  const groups = CARDS.map((group) => ({
    ...group,
    shown: term ? group.pages.filter((page) => haystack(page).includes(term)) : group.pages,
  })).filter((group) => group.shown.length > 0)
  const hits = groups.reduce((n, g) => n + g.shown.length, 0)

  const rowProps = (path) => {
    const props = linkProps(path)
    return {
      href: props.href,
      onClick: (event) => {
        props.onClick(event)
        // A guide link is left to the browser, which unmounts this sheet on
        // its own; close only when we handled it.
        if (event.defaultPrevented) close()
      },
    }
  }

  const onFindKey = (event) => {
    const first = listRef.current?.querySelector('.sitemenusheet__item')
    if (!first) return
    if (event.key === 'Enter') { event.preventDefault(); first.click() }
    if (event.key === 'ArrowDown') { event.preventDefault(); first.focus() }
  }

  return (
    <dialog
      ref={dialogRef}
      className="scrim scrim--site-menu"
      aria-label="Site menu"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && close()}
    >
      <div className={`sheet sitemenusheet${term ? ' sitemenusheet--finding' : ''}`}>
        {/* No title bar: the dialog is named by its aria-label, and the close
            sits at the end of the find row. */}
        <div className="sitemenusheet__top">
        <nav className="sitemenusheet__yours" aria-label={YOURS.label}>
          {YOURS.pages.map((item) => (
            <a key={item.path} className="btn" {...rowProps(item.path)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sitemenusheet__find">
          <div className="sitemenusheet__findrow">
          <div className="searchfield">
            <span className="searchfield__glyph" aria-hidden="true">
              <FindGlyph />
            </span>
            <input
              type="search"
              enterKeyHint="go"
              className="searchfield__input"
              placeholder="Find a page"
              aria-label="Find a page"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onFindKey}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <IconButton onClick={close} label="Close">
            ✕
          </IconButton>
          </div>
          <p className="sitemenusheet__count" aria-live="polite">
            {term ? `${hits} page${hits === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        </div>

        <div className="sitemenusheet__scroll" ref={listRef}>
          {groups.map((group, i) => {
            const open = wide || term !== '' || (folded[group.id] ?? i < 2)
            return (
              <Card key={group.id} frame="stamped" body="flush" className="sitemenusheet__group">
                {wide || term ? (
                  <DirectoryHeading group={group} as="h3" count={group.pages.length} />
                ) : (
                  <h3 className="sitemenusheet__fold">
                    <button
                      type="button"
                      className="sitemenusheet__toggle"
                      aria-expanded={open}
                      onClick={() => setFolded((f) => ({ ...f, [group.id]: !open }))}
                    >
                      <DirectoryHeading group={group} as="span" count={group.pages.length} />
                      <span className="sitemenusheet__sign" aria-hidden="true">{open ? '–' : '+'}</span>
                    </button>
                  </h3>
                )}
                <ul className="navdir__list" hidden={!open}>
                  {group.shown.map((item) => (
                    <li key={item.path}>
                      <a className="dirlink dirlink--described sitemenusheet__item" {...rowProps(item.path)}>
                        {item.label}
                        <span className="dirlink__desc">
                          {item.desc}
                          {item.was && <span className="dirlink__was"> (was {item.was})</span>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
          {term && hits === 0 && (
            <p className="sitemenusheet__empty">No page matches that. Try a stat, a club word, or “umpire”.</p>
          )}
          {!term && (
          <div className="navdir__trail sitemenusheet__trail">
            {TRAIL.map((group) => (
              <div key={group.id} className="navdir__trail-group">
                <DirectoryHeading group={group} as="h3" />
                <ul className="navdir__list">
                  {group.pages.map((item) => (
                    <li key={item.path}>
                      <a className="dirlink dirlink--trail" {...rowProps(item.path)}>
                        {item.label}
                        {/* Says the row leaves the app for a server-rendered
                            document — visible text, never a title= tooltip. */}
                        {isGuidePath(item.path) && <span className="dirtag">Guide</span>}
                      </a>
                    </li>
                  ))}
                  {/* The admin row rides "The site", where the site's own pages
                      live. Not a MENU_GROUPS entry: that registry also feeds
                      both footers and /more, none of them role-aware. */}
                  {AdminMenuLink && group.id === 'tools' && (
                    <Suspense fallback={null}>
                      <AdminMenuLink onNavigate={close} />
                    </Suspense>
                  )}
                </ul>
              </div>
            ))}
          </div>
          )}
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

function FindGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path d="m12 12 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
