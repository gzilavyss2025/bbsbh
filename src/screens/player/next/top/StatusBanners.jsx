import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { statusBannersView } from '../../statusBanners.js'

const MARK = { allstar: '★', rehab: '✚', il: '✚' }

// The first top card (TbdWire "Status banners"): All-Star, rehab, injured list, last played, in
// a plain stamped card. The text and rules are the live page's (statusBanners.js). Hides when
// none applies.
export function StatusBanners({ core }) {
  const list = statusBannersView(core)
  if (!list.length) return null
  return (
    <Card frame="stamped" label="Status banners" className="pnext__slot pnext__top">
      <Stack gap="tight">
        {list.map((b) => (
          <p key={b.key} role="note" className="pnext__banner">
            {MARK[b.key] && <span aria-hidden="true">{MARK[b.key]} </span>}
            {b.text}
          </p>
        ))}
      </Stack>
    </Card>
  )
}
