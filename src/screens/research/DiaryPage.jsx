import '../../styles/research/diary.css'
import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'

// The admin research diaries' one page: the prospect-research diary
// (ResearchDiaryPage.jsx, /admin/research) and the Contender Diary
// (contenders/ContenderDiaryPage.jsx, /admin/contenders). Each passes its own
// content module (`diary`: HOW_TO_READ, RESEARCH_DIARY, TRAPS, VERDICTS) and its
// words; the verdict vocabularies differ through that module, not through here.
// The Contender Diary began as a line-for-line copy, kept apart until it was
// clear the shape stayed identical. It did, so the copy went.
//
// WHO IT IS FOR, which decided everything else about it. A reader who does not
// know what a p-value is and should not have to. So the prose carries the
// findings in baseball terms and the formal statistics sit at the foot of each
// entry behind a disclosure, for the one reader in ten who wants them. That
// split is why the entries are authored prose rather than a rendering of the
// underlying numbers: the translation IS the work here.
//
// WHY IT IS ADMIN-ONLY. Not because any of it is sensitive — it is baseball
// research and every entry's method is already public in docs/. It is
// that this is a working notebook with retractions in it, and a retraction on
// a public page reads as a correction notice rather than as the ordinary way
// research moves. Same client-side Clerk role check the copy editor makes; it
// is a "keep it out of the way" gate, not a security boundary, and there is
// no endpoint behind it to protect.
//
// NOTHING HERE IS SCORE-BEARING. Every number on either diary is a duration, a
// season or career total, a bracket rung, or a count of players. No game, no
// linescore, no reveal state.

function Shell({ title, children }) {
  useDocumentTitle(title)
  return (
    <div className="screen researchdiary">
      <SiteHeader />
      <main className="researchdiary__main">{children}</main>
      <ReportFooter />
    </div>
  )
}

// The traps heading counts them, and the count was hardcoded once and went
// stale the first time the list grew. Spelled out rather than a numeral,
// because this page writes numbers as words in prose, and derived rather than
// typed, because a number typed next to a list it describes is a number that
// will be wrong again.
const COUNT_WORDS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen',
]
function countWord(n) {
  return COUNT_WORDS[n] ?? String(n)
}

function Notice({ children }) {
  return <p className="researchdiary__notice caps-exempt">{children}</p>
}

function Table({ table }) {
  return (
    <figure className="researchdiary__figure">
      <figcaption className="t-label researchdiary__figcap">{table.caption}</figcaption>
      {/* Wide tables scroll inside their own box rather than pushing the page
          sideways — this is a phone-first app and some of these run four
          columns of long club names. */}
      <div className="researchdiary__tablewrap">
        <table className="researchdiary__table">
          <thead>
            <tr>
              {table.columns.map((col, i) => (
                <th key={col || i} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row[0]}>
                <th scope="row">{row[0]}</th>
                {row.slice(1).map((cell, i) => (
                  <td key={`${row[0]}-${table.columns[i + 1]}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="researchdiary__fignote caps-exempt">{table.note}</p>}
    </figure>
  )
}

function Section({ section }) {
  return (
    <section className="researchdiary__section">
      <h3 className="researchdiary__subhead">{section.heading}</h3>
      {section.prose?.map((p) => (
        <p key={p.slice(0, 40)} className="researchdiary__prose caps-exempt">
          {p}
        </p>
      ))}
      {section.table && <Table table={section.table} />}
      {section.points && (
        <ul className="researchdiary__points">
          {section.points.map((point) => (
            <li key={point.slice(0, 40)} className="caps-exempt">
              {point}
            </li>
          ))}
        </ul>
      )}
      {section.proseAfter?.map((p) => (
        <p key={p.slice(0, 40)} className="researchdiary__prose caps-exempt">
          {p}
        </p>
      ))}
    </section>
  )
}

// The formal statement, folded away. A reader who wants the coefficients gets
// them; a reader who does not is never shown a p-value at all.
function Technical({ points }) {
  const [open, setOpen] = useState(false)
  if (!points?.length) return null
  return (
    <div className="researchdiary__technical">
      <button
        type="button"
        className="researchdiary__disclose"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '− ' : '+ '}
        The statistical version
      </button>
      {open && (
        <ul className="researchdiary__techlist">
          {points.map((point) => (
            <li key={point.slice(0, 40)} className="caps-exempt">
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Entry({ entry, verdicts }) {
  const verdict = verdicts[entry.verdict]
  return (
    <article className="researchdiary__entry" id={entry.id}>
      <header className="researchdiary__entryhead">
        <p className="researchdiary__meta t-label t-label--nocaps">
          <time dateTime={entry.date}>{entry.date}</time>
          <span className="researchdiary__source">{entry.source}</span>
          <span className={`researchdiary__verdict researchdiary__verdict--${entry.verdict}`}>
            {verdict.label}
          </span>
        </p>
        <h2 className="researchdiary__title">{entry.title}</h2>
        <p className="researchdiary__verdictblurb caps-exempt">{verdict.blurb}</p>
      </header>

      <p className="researchdiary__question caps-exempt">{entry.question}</p>
      <p className="researchdiary__headline caps-exempt">{entry.headline}</p>

      {entry.sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}

      <div className="researchdiary__limits">
        <h3 className="researchdiary__subhead">What this does not settle</h3>
        <ul className="researchdiary__points">
          {entry.caveats.map((caveat) => (
            <li key={caveat.slice(0, 40)} className="caps-exempt">
              {caveat}
            </li>
          ))}
          {entry.open.map((item) => (
            <li key={item.slice(0, 40)} className="caps-exempt">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Technical points={entry.technical} />

      <p className="researchdiary__doc caps-exempt">
        Full write-up, with the method in detail: <code>{entry.doc}</code>
      </p>
    </article>
  )
}

function Diary({ diary, heading }) {
  return (
    <>
      <header className="researchdiary__masthead">
        <p className="researchdiary__eyebrow">Working notebook</p>
        <h1 className="researchdiary__masttitle">{heading}</h1>
        {diary.HOW_TO_READ.map((p) => (
          <p key={p.slice(0, 40)} className="researchdiary__lede caps-exempt">
            {p}
          </p>
        ))}
      </header>

      <section className="researchdiary__traps">
        <h2 className="researchdiary__trapshead">{countWord(diary.TRAPS.length)} things that will fool you</h2>
        <p className="researchdiary__prose caps-exempt">
          Each of these cost real work to find, and each one will bite the next person who reads a
          number out of this data without knowing about it.
        </p>
        <dl className="researchdiary__traplist">
          {diary.TRAPS.map((trap) => (
            <div key={trap.id} className="researchdiary__trap">
              <dt className="researchdiary__traptitle">{trap.title}</dt>
              <dd className="researchdiary__trapbody caps-exempt">{trap.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ol className="researchdiary__entries">
        {diary.RESEARCH_DIARY.map((entry) => (
          <li key={entry.id}>
            <Entry entry={entry} verdicts={diary.VERDICTS} />
          </li>
        ))}
      </ol>
    </>
  )
}

// Same gate the copy editor uses, and the same reasoning: a client-side role
// check that keeps the page out of the way of people it would only confuse.
function DiaryGate({ diary, heading, name }) {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded) return <Notice>Checking your access…</Notice>
  if (!isSignedIn) {
    return <Notice>Sign in with an admin account to read {name}.</Notice>
  }
  if (user?.publicMetadata?.role !== 'admin') {
    return <Notice>This account is signed in but does not have the admin role.</Notice>
  }
  return <Diary diary={diary} heading={heading} />
}

// `title` is the tab title, `heading` the masthead, `name` the diary mid-sentence
// ("the research diary") and `Name` the same at the start of one.
export function DiaryPage({ diary, title, heading, name, Name }) {
  return (
    <Shell title={title}>
      {isClerkEnabled ? (
        <DiaryGate diary={diary} heading={heading} name={name} />
      ) : (
        <Notice>
          {Name} needs sign-in configured on this deploy. The findings themselves live in{' '}
          <code>docs/</code> either way.
        </Notice>
      )}
    </Shell>
  )
}
