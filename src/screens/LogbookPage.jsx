import { lazy, Suspense } from 'react'
import { useBooks } from '../hooks/useBooks.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { DEFAULT_BOOK_ID } from '../lib/books.js'
import { pathForBook } from '../lib/logbookNav.js'
import { logbookNewPath, logbookPath, logbookPlacePath } from '../lib/route.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { LogbookShelf } from '../components/passport/LogbookShelf.jsx'
import { Loader } from '../components/ui/Loader.jsx'
import { LogbookLanding } from '../components/account/LogbookLanding.jsx'
import { LogbookCollection } from './LogbookCollection.jsx'
import { NewBookPage } from './logbook/NewBookPage.jsx'

const LogbookAccountGate = isClerkEnabled
  ? lazy(() =>
      import('../components/account/LogbookAccountGate.jsx').then((module) => ({
        default: module.LogbookAccountGate,
      })),
    )
  : null

// The Logbook — your passport book of game stamps (ADR-0035, ADR-0036). This
// file is the route-facing shell: the signed-out pitch / Clerk gate, and the
// resolver (`LogbookRoot`) that decides WHICH book a visit means. One open
// book's whole page — topbar, tray, the passport book, the season grid — is
// `LogbookCollection.jsx`; read that file's header for the placement flow and
// the spoiler-containment argument (both unchanged by this split, which
// happened only because the multi-book shelf below pushed this file past
// check-file-size.mjs's 600-line ceiling).
//
// ===========================================================================
// Multiple books, and the address a bare /logbook resolves to (ADR-0036's
// multi-book addendum)
// ===========================================================================
// A user can now hold more than one named book (src/lib/books.js,
// src/hooks/useBooks.js) — a shelf of covers rather than one fixed passport.
// Two routes matter here, and they resolve differently on purpose:
//
//   - '/logbook' and '/logbook/{season}' (src/lib/route.js) are UNCHANGED,
//     byte-for-byte, and every stamp minted before this feature shipped
//     already lives in DEFAULT_BOOK_ID (the migration in useBooks.js). A
//     SEASON deep link therefore always means that one book — real shared
//     links keep resolving exactly as they did the day they were sent,
//     with no shelf in between. The BARE route is the one exception:
//     exactly one live book still opens directly (zero behavior change for
//     the common case), but two or more surface `LogbookShelf` instead.
//   - '/logbook/book/{bookId}[/{season}|/stats]' is the additive way to
//     deep-link or bookmark a NON-default book — INCLUDING the default one
//     once a shelf exists, which is the whole of `lib/logbookNav.js`'s job:
//     while `/logbook` means the shelf, it is not an address the default book
//     can also answer to, and treating it as one made that book unopenable.
//
// `LogbookRoot` below is the resolver; `LogbookCollection` (imported) takes
// the resolved `book` record as a prop rather than ever guessing which one
// it is drawing.
//
// ===========================================================================
// The stamp stays in hand the whole way through
// ===========================================================================
// `placing` (the `?place={gamePk}` hand-off from the box score's mint card) is
// carried by EVERY route this resolver can send you to: the shelf, a book, and
// the new-book page. Picking a book for a stamp is one flow, and a step of it
// that quietly drops the stamp back into the tray reads as the app losing it.

export function LogbookPage(props) {
  useDocumentTitle('Game Log')

  // Local visual handoff for a surface that otherwise needs a configured,
  // signed-out Clerk session. DEV-only, so production auth remains the only
  // way into the pitch; route parsing already ignores query strings.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('signedout')) {
    return <LogbookLanding />
  }

  if (LogbookAccountGate) {
    return (
      <Suspense fallback={<LogbookGateLoader />}>
        <LogbookAccountGate Book={LogbookRoot} pageProps={props} />
      </Suspense>
    )
  }

  return <LogbookRoot {...props} />
}

function LogbookGateLoader() {
  return (
    <div className="screen logbook">
      <SiteHeader />
      <Loader />
      <ReportFooter />
    </div>
  )
}

// Resolves WHICH book this visit means, then hands off to the page that
// actually draws one. `useBooks()`'s migration guarantees `books` is never
// empty, so every branch below has a real record to render — there is no
// "zero books" state downstream of this component.
function LogbookRoot({
  bookId: routeBookId = null,
  season: requestedSeason = null,
  placing = null,
  creating = false,
}) {
  const navigate = useNav()
  const { books, createBook, updateCover, removeBook } = useBooks()
  // Only the shelf branch below actually needs this (its management sheet's
  // "remove a book" un-places that book's stamps) — called unconditionally
  // anyway, same as every other hook here, per the rules of hooks. Cheap:
  // localStorage-backed, same as useBooks().
  const { all, unplace } = useStamps()

  // '/logbook/new'. FIRST, and above every book-resolving branch below, which
  // is the whole point of giving the create flow its own address: nothing else
  // on the shelf is mounted while a cover is being chosen. `createBook` comes
  // from THIS hook instance rather than a second one nested inside the page —
  // see BookManagementSheet.jsx's header for what a second instance races.
  //
  // A stamp in hand rides through: the new book opens in placement mode, so
  // "start a book for this one" is a real answer to which book it goes in, and
  // cancelling puts the shelf back the way it was rather than dropping it.
  if (creating) {
    return (
      <NewBookPage
        createBook={createBook}
        placing={placing}
        onCreated={(id) => navigate(pathForBook({ id }, { placing }))}
        onCancel={() => navigate(placing ? logbookPlacePath(placing) : logbookPath())}
      />
    )
  }

  if (routeBookId) {
    const named = books.find((b) => b.id === routeBookId)
    if (named) {
      return (
        <LogbookCollection key={named.id} book={named} season={requestedSeason} placing={placing} />
      )
    }
    // An unknown or removed book id degrades exactly like an unrecognised
    // season does elsewhere in this app (route.js) — fall through to the
    // ordinary bare-route resolution below rather than stranding the visitor
    // on a dead link.
  }

  // A season deep link — bookmarked, shared, or built by logbookPath() — is
  // one of the two byte-for-byte-unchanged routes, and it always means the
  // DEFAULT book (see this file's header). It never shows the shelf, even
  // when the user holds several books: only the bare route branches on book
  // count.
  if (requestedSeason != null && !routeBookId) {
    const book = books.find((b) => b.id === DEFAULT_BOOK_ID) ?? books[0]
    return <LogbookCollection key={book.id} book={book} season={requestedSeason} placing={placing} />
  }

  // The bare route. Exactly one live book — the ordinary case, and likely to
  // stay that way for most users for a long time — opens it directly, with
  // zero extra tap and zero behavior change from before this feature
  // existed. Two or more surface the shelf instead.
  if (books.length <= 1) {
    const book = books[0]
    return <LogbookCollection key={book.id} book={book} season={requestedSeason} placing={placing} />
  }

  return (
    <div className="screen logbook">
      <SiteHeader />
      {/* Title first and hard left, the same shape the open book's own head
          takes — the page says what it is before it says what you can do to
          it. */}
      <header className="topbar logbook__head">
        <h1 className="topbar__title">Game Log</h1>
      </header>
      <LogbookShelf
        books={books}
        placing={placing}
        placingStamp={placing ? all.find((s) => s.gamePk === placing) ?? null : null}
        // `bookCount` is what stops the default book's cover navigating to the
        // shelf it was tapped from — see lib/logbookNav.js. This branch only
        // runs at two or more books, so the fold never applies here; passing it
        // anyway keeps the rule in one place rather than relying on where the
        // call happens to sit.
        onOpenBook={(book) => navigate(pathForBook(book, { placing, bookCount: books.length }))}
        onNewBook={() => navigate(logbookNewPath(placing))}
        updateCover={updateCover}
        removeBook={removeBook}
        stamps={all}
        unplaceStamp={unplace}
      />
      <ReportFooter />
    </div>
  )
}
