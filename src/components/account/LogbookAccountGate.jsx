import { SignInButton, SignUpButton, useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../chrome/SiteHeader.jsx'
import { ReportFooter } from '../chrome/ReportFooter.jsx'
import { Loader } from '../ui/Loader.jsx'
import { LogbookLanding } from './LogbookLanding.jsx'

function SignUpAction({ className, children }) {
  return (
    <SignUpButton mode="modal">
      <button type="button" className={className}>
        {children}
      </button>
    </SignUpButton>
  )
}

function SignInAction({ className, children }) {
  return (
    <SignInButton mode="modal">
      <button type="button" className={className}>
        {children}
      </button>
    </SignInButton>
  )
}

// This component is reached only through LogbookPage's Clerk-configured
// dynamic import. Waiting for Clerk is distinct from an empty book: rendering
// the collection before auth resolves would briefly expose local contents and
// then replace them with the signed-out pitch.
export function LogbookAccountGate({ Book, pageProps }) {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="screen logbook">
        <SiteHeader />
        <Loader />
        <ReportFooter />
      </div>
    )
  }

  if (isSignedIn) return <Book {...pageProps} />

  return <LogbookLanding SignUpAction={SignUpAction} SignInAction={SignInAction} />
}
