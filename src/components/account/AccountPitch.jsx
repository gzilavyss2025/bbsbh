import { SignedIn, SignedOut, SignUpButton, useUser } from '@clerk/clerk-react'
import { SYNCED_ITEMS } from '../../lib/account/syncClaims.js'
import { ClubSeal } from '../profile/ClubSeal.jsx'
import { DeviceHandoff } from '../profile/DeviceHandoff.jsx'
import { IntroPassportMark } from './IntroPassportMark.jsx'

// Step 2 of the first-visit intro (PRD §6.1/§6.4) — "Take your Tally with
// you." Rendered only when isClerkEnabled; FavoriteTeamModal lazy-loads this
// file for exactly that reason (it imports @clerk/clerk-react at its top).
//
// Two branches, and they are deliberately NOT symmetric:
//   - SIGNED OUT gets the pitch — create an account.
//   - SIGNED IN (a returning visitor on a cleared browser, or someone who
//     completed sign-in mid-flow) gets a CONFIRMATION instead, naming the
//     club they just picked and the cross-device state that already applies.
//     Pitching account creation to someone already signed in, or leading with
//     their email address, both read as the app not knowing who they are —
//     the task this program set out to avoid.
//
// The three benefit rows render FROM src/lib/account/syncClaims.js
// (SYNCED_ITEMS), never hand-written, so this screen cannot promise a sync the
// app does not actually run. INTRO_BENEFIT_LABELS only renames the DISPLAY
// text for this warmer, onboarding-specific moment — the ids it reads
// (reveal/spoiledDays/stamps) still have to exist in the ledger, so a claim
// here still traces back to a real wired channel; a renamed or removed id
// simply drops its row rather than throwing.
const INTRO_BENEFIT_IDS = ['reveal', 'spoiledDays', 'stamps']
const INTRO_BENEFIT_LABELS = {
  reveal: 'Game progress',
  spoiledDays: 'Spoiler choices',
  stamps: 'Game Log',
}

function BenefitRows() {
  return (
    <ul className="introsheet__benefits">
      {INTRO_BENEFIT_IDS.map((id) => {
        const claim = SYNCED_ITEMS.find((item) => item.id === id)
        if (!claim) return null
        const isGameLog = id === 'stamps'
        return (
          <li key={id}>
            <span className="introsheet__benefitlabel">
              {isGameLog && <IntroPassportMark />}
              {INTRO_BENEFIT_LABELS[id]}
            </span>
            <span className="introsheet__benefitblurb caps-exempt">{claim.blurb}</span>
          </li>
        )
      })}
    </ul>
  )
}

// A progress marker that is illustrative rather than real — nine ticks, seven
// filled, captioned as an EXAMPLE ("say, ..."), never a result (PRD §6.4
// element 3 / invariant P5). No gamePk, no club, nothing fetched.
function ProgressMarker() {
  return (
    <p className="introsheet__marker caps-exempt">
      <span className="introsheet__markerticks" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className={`introsheet__markertick${i < 7 ? ' is-filled' : ''}`}
          />
        ))}
      </span>
      A game you&rsquo;re mid-way through waits right where you left it — say,
      through top 7 — on every device.
    </p>
  )
}

export function AccountPitch({ clubTeamId, clubName, onContinue }) {
  return (
    <div className="introsheet__step2">
      <SignedOut>
        <div className="introsheet__visual">
          <ClubSeal teamId={clubTeamId} name={clubName} size={64} />
          <DeviceHandoff className="introsheet__handoff" />
        </div>
        <ProgressMarker />
        <BenefitRows />
        <SignUpButton mode="modal">
          <button type="button" className="btn btn--account introsheet__primary">
            Create my Tally
          </button>
        </SignUpButton>
        <button
          type="button"
          className="btn btn--ghost introsheet__secondary"
          onClick={onContinue}
        >
          Use this device only
        </button>
        <p className="introsheet__fineprint caps-exempt">
          No public profile, no leaderboard, no social feed. A score is never
          synced — only how far you have opened each game.
        </p>
      </SignedOut>
      <SignedIn>
        <SignedInConfirmation clubName={clubName} onContinue={onContinue} />
      </SignedIn>
    </div>
  )
}

// A visitor who reaches step 2 already signed in — a returning visitor whose
// browser storage was cleared, or someone who finished sign-in mid-flow —
// gets told what already applies, not pitched something they already have.
// The email address is fine print, not the lede: confirming the club and the
// cross-device state comes first.
function SignedInConfirmation({ clubName, onContinue }) {
  const { user } = useUser()
  const who = user?.primaryEmailAddress?.emailAddress || user?.username || ''
  return (
    <div className="introsheet__confirm">
      {/* The club list is async, so `clubName` is empty on first paint — which
          is every time this branch renders. The two halves are written as whole
          sentences rather than one sentence with a hole in it, because the
          hole-less version read "You're already signed in, your reveal
          progress, and your Game Log already travel with you". */}
      <p className="introsheet__confirmlede caps-exempt">
        {clubName
          ? `You’re already signed in — your ${clubName} pick, your reveal progress, and your Game Log already travel with you to every device you sign in on.`
          : 'You’re already signed in — your club pick, your reveal progress, and your Game Log already travel with you to every device you sign in on.'}
      </p>
      <BenefitRows />
      <button
        type="button"
        className="btn btn--account introsheet__primary"
        onClick={onContinue}
      >
        Continue
      </button>
      {who && <p className="introsheet__fineprint caps-exempt">Signed in as {who}.</p>}
    </div>
  )
}
