// See cwb-mount.html. The candidates are made up; the component and the CSS are
// the ones the admin page ships (index.css, then the workbench partial the page
// imports for itself).
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import '../../../src/styles/74-contract-workbench.css'
import { CandidateList } from '../../../src/components/admin/contracts/CandidateList.jsx'

const candidates = [
  { id: 1, lastFirstName: 'Smith, John', score: 0.82, reasons: ['position match', 'service time fits'], inRows: 2, ofRows: 3 },
  { id: 2, lastFirstName: 'Smith, Jon', score: 0.41, reasons: [], inRows: 1, ofRows: 3 },
]

createRoot(document.getElementById('root')).render(
  <main className="screen" style={{ padding: 16 }}>
    <div className="cwb">
      <CandidateList rawName="Smith, John" candidates={candidates} onPick={() => {}} showRowShare />
    </div>
  </main>,
)
