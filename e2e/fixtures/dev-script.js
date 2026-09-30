// The npm script that starts the dev server on a reserved port (CLAUDE.md, "Reserved
// dev ports"). Both Playwright configs launch it, so a cold run binds the port it
// was told to use. An unreserved port falls back to `dev`.
const DEV_SCRIPTS = { 5173: 'dev', 5172: 'dev:2', 5171: 'dev:3', 5170: 'dev:4', 5169: 'dev:5' }

export const devScript = (port) => DEV_SCRIPTS[port] ?? 'dev'
