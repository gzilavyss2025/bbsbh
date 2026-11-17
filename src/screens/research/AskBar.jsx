import { useId, useState } from 'react'
import { applySuggestion, suggest } from '../../api/research/ask.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// THE ASK BAR (/research, #3138; wireframe v3, Gary 2026-11-17): type a question in plain
// English and the page fills the filters (api/research/ask.js) and runs the normal search.
// Suggestions show only while typing. After Ask, the sentence stays, with the words it
// could not read underlined; the Filters pills show what it did read. The answer card adds
// "Searched without: …". The bar holds only its own text; the query lives in the URL.

// The sentence with its skipped spans underlined.
function Marked({ text, skipped }) {
  const out = []
  let at = 0
  skipped.forEach((s, i) => {
    out.push(text.slice(at, s.start), <u key={i} className="research__skipped">{text.slice(s.start, s.end)}</u>)
    at = s.end
  })
  out.push(text.slice(at))
  return out
}

// `asked`: { text, skipped, read } from the last Ask, or null. `onAsk(text)` parses and searches.
export function AskBar({ asked, clubs, onAsk }) {
  const id = useId()
  const [text, setText] = useState(asked?.text ?? '')
  const [typing, setTyping] = useState(false)
  const list = typing ? suggest(text, { clubs }) : []
  const submit = (e) => {
    e.preventDefault()
    setTyping(false)
    if (text.trim()) onAsk(text.trim())
  }
  return (
    <Stack gap="tight" className="research__ask">
      <form onSubmit={submit}>
        <Cluster className="research__askrow">
          <label className="sr-only" htmlFor={id}>Ask a question</label>
          <input
            id={id}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Ask a question"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setTyping(true)
            }}
            onBlur={() => setTyping(false)}
          />
          <Button size="control" skin="ink" type="submit">Ask</Button>
        </Cluster>
      </form>
      {list.length > 0 && (
        <ul className="research__suggest" aria-label="Suggestions">
          {list.map((s) => (
            <li key={s.text}>
              {/* onMouseDown keeps the input's focus, so the blur does not drop the list first. */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setText(applySuggestion(text, s.text))}>
                {s.text}<span className="t-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!asked && !list.length && <p className="t-label t-label--nocaps">For example: last time a lefty hit an oppo homer off a lefty’s sinker</p>}
      <div aria-live="polite">
        {asked && asked.read === 0 && <p className="t-label t-label--nocaps">No words in that question are ones the bar knows. Try a suggestion, or build it with the filters.</p>}
        {asked && asked.read > 0 && asked.skipped.length > 0 && (
          <p className="research__asked"><span className="t-label">Skipped</span> <Marked text={asked.text} skipped={asked.skipped} /></p>
        )}
      </div>
    </Stack>
  )
}
