// Tally branding for every Clerk-rendered surface (the sign-in modal and the
// UserButton account menu). Two layers, matching how Clerk theming works:
//
// - `variables` — Clerk derives hover/disabled shades from these, so they must
//   be concrete colors, not CSS var() references. Each one mirrors a token in
//   src/tokens/colors.css (named in the trailing comment); if a token changes,
//   change it here too.
// - `elements` — class names we own, styled in src/index.css with the real
//   semantic tokens (Clerk renders in our DOM, so var() resolves there).
//   That's where the scorebook character lives: condensed uppercase headers,
//   the paper card, the ink-navy primary button.
//
// Passed to ClerkProvider in main.jsx, so the UserButton popover inherits it
// too. Only ever imported when isClerkEnabled (see clerkConfig.js).
export const clerkAppearance = {
  variables: {
    colorPrimary: '#1B2A3A', // --navy / --accent-primary
    colorText: '#1B2A3A', // --ink-1 / --text-body
    colorTextSecondary: '#6B6558', // --graphite / --text-caption
    colorBackground: '#FBF6E9', // --paper-2 / --surface-card
    colorInputBackground: '#FFFDF6', // --paper-3 / --surface-inset
    colorInputText: '#1B2A3A', // --ink-1
    colorDanger: '#B4453A', // --clay / --accent-negative
    colorSuccess: '#2F6E4F', // --field / --accent-positive
    colorWarning: '#B5824A', // --seal (kraft amber)
    colorNeutral: '#1B2A3A', // --ink-1 — Clerk mixes its grays from this
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif', // --font-body
    borderRadius: '6px',
  },
  elements: {
    card: 'tally-cl-card',
    headerTitle: 'tally-cl-title',
    headerSubtitle: 'tally-cl-subtitle',
    formButtonPrimary: 'tally-cl-primary',
    formFieldLabel: 'tally-cl-label',
    socialButtonsBlockButton: 'tally-cl-social',
    dividerText: 'tally-cl-label',
    footerActionLink: 'tally-cl-link',
    userButtonPopoverCard: 'tally-cl-card',
    userButtonPopoverActionButton: 'tally-cl-menuitem',
    // <UserProfile routing="virtual" />, mounted inside My Tally's account
    // section (/profile). Extended HERE rather than passed as a second
    // appearance object at that call site, so the sign-in modal, the
    // UserButton popover and the profile card stay ONE visual system — a
    // second object is how two Clerk surfaces drift apart.
    rootBox: 'tally-cl-root',
    cardBox: 'tally-cl-cardbox',
    navbar: 'tally-cl-navbar',
    navbarButton: 'tally-cl-navbtn',
    pageScrollBox: 'tally-cl-page',
    profileSectionTitleText: 'tally-cl-sectiontitle',
    profileSectionPrimaryButton: 'tally-cl-link',
    formButtonReset: 'tally-cl-link',
  },
}

// Copy on the Clerk screens, rephrased in Tally's voice — an account exists to
// keep the paper scorebook in sync, so say the COMPLETE benefit (club and
// settings, reveal progress, spoiler choices, and the Game Log — the same
// four claims src/lib/account/syncClaims.js guards) instead of Clerk's
// generic "to continue to {app}" or an earlier draft that named reveal
// progress alone. Partial override; everything not named here keeps Clerk's
// default strings. "Never a score" stays in both: docs/game-log.md §3.3 rule
// 4 — sync is a convenience, never a promise of backup, and neither subtitle
// may imply otherwise.
export const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to Tally',
      subtitle:
        'Your club, reveal progress, spoiler choices, and Game Log — on any device you sign in on',
    },
  },
  signUp: {
    start: {
      title: 'Create your Tally account',
      subtitle:
        'Keep your club, reveal progress, spoiler choices, and Game Log together on every device — never a score',
    },
  },
  // The account menu's own item, renamed so it says the same thing My Tally's
  // disclosure says. Clerk's default is "Manage account"; what the screen behind
  // it actually holds is email, connected accounts, passkeys, active devices
  // and account deletion — security, not settings, which live on /profile.
  userButton: {
    action__manageAccount: 'Account & security',
  },
}
