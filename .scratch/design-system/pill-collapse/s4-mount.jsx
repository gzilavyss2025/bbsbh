// See s4-mount.html. The component and the CSS are the ones the admin pages
// ship: index.css, then the partials the components import for themselves.
// The two hero grounds are made-up club tiles (a navy and a gold one), with the
// readable ink the shell would pick for each; `--tint` and `--ink` are the two
// properties TeamHubShell.jsx sets on the real hero.
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import '../../../src/styles/62-identity-admin.css'
import { LookupDeck } from '../../../src/components/admin/contracts/LookupDeck.jsx'
import { Button } from '../../../src/components/ui/control/Button.jsx'

const after = new URLSearchParams(location.search).has('after')

function AdminBar() {
  if (after) {
    return (
      <span className="idadmin__actions">
        <Button size="control" className="idadmin__btn">
          Cancel
        </Button>
        <Button size="control" className="idadmin__btn">
          Save
        </Button>
      </span>
    )
  }
  return (
    <span className="idadmin__actions">
      <button type="button" className="idadmin__btn">
        Cancel
      </button>
      <button type="button" className="idadmin__btn idadmin__btn--save">
        Save
      </button>
    </span>
  )
}

function Hero({ tint, ink, id }) {
  return (
    <div
      data-hero={id}
      style={{ '--tint': tint, '--ink': ink, background: tint, color: ink, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}
    >
      <AdminBar />
    </div>
  )
}

function DrawerButton() {
  return (
    <span className="iddrawer__logoactions">
      {after ? (
        <Button size="control" className="iddrawer__btn">
          Upload a PNG
        </Button>
      ) : (
        <button type="button" className="iddrawer__btn">
          Upload a PNG
        </button>
      )}
    </span>
  )
}

createRoot(document.getElementById('root')).render(
  <main className="screen" style={{ padding: 16 }}>
    <Hero id="navy" tint="#12284b" ink="#ffffff" />
    <Hero id="gold" tint="#ffc52f" ink="#12284b" />
    <div style={{ padding: 12, marginBottom: 12 }}>
      <DrawerButton />
    </div>
    <LookupDeck selectedRow={{ id: 1 }} onUseAsMatch={() => {}} disabled={false} />
  </main>,
)
