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
  },
}

// Copy on the Clerk screens, rephrased in Tally's voice — an account exists to
// keep the paper scorebook's reveal progress in sync, so say that instead of
// Clerk's generic "to continue to {app}". Partial override; everything not
// named here keeps Clerk's default strings.
export const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to Tally',
      subtitle: 'Pick up your scorebook on any of your devices',
    },
  },
  signUp: {
    start: {
      title: 'Create your Tally account',
      subtitle: 'Your reveal progress follows you to every device — never a score',
    },
  },
}
