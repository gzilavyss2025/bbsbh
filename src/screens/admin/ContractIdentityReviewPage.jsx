// The historical-contract identity workbench (ADR-0066, route /admin/contracts,
// admin only, unlinked). Reviews every row scripts/gen-contracts-identity.mjs
// could not confidently match on its own and lets an admin settle it without
// touching a spreadsheet.
//
// Reads TWO separate things and merges them client-side, deliberately not
// through one API call: public/data/contracts-history/identity/pending.json
// (the pending rows, a static file the CDN can cache) and
// GET /api/contract-identity (the small Redis-backed override map — see that
// file's own header for why these are not the same endpoint).
//
// THE OVERRIDE MAP IS SERVER TRUTH. Every PATCH echoes the whole stored map
// back and it REPLACES this page's copy wholesale. Nothing is merged locally,
// because a second reviewer's correction only reaches this tab through that
// echo, and a local merge would quietly outrank it.
//
// This file owns the page's state, both fetches, and the keyboard layer; the
// four regions render from components/admin/contracts/. NOTHING HERE IS
// SCORE-BEARING — historical contract records and MLB ids only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { saveContractIdentityPatch } from '../../lib/admin/saveContractIdentityPatch.js'
import {
  MODE_CHOOSE,
  MODE_CONFIRM,
  buildGroups,
  candidatePatch,
  confirmPatch,
  dismissPatch,
  isGroupResolved,
  tierCounts,
} from '../../lib/admin/contractGroups.js'
import { TierBar } from '../../components/admin/contracts/TierBar.jsx'
import { ReviewQueue } from '../../components/admin/contracts/ReviewQueue.jsx'
import { DecisionPane } from '../../components/admin/contracts/DecisionPane.jsx'
import { LookupDeck } from '../../components/admin/contracts/LookupDeck.jsx'
import '../../styles/research/diary.css'

// Stable references for the "no data yet" fallback — a fresh {} or [] every
// render would defeat every memo below on every keystroke.
const EMPTY_OVERRIDES = {}
const EMPTY_ROWS = []

function Shell({ children }) {
  useDocumentTitle('Contract identity review')
  return (
    <div className="screen researchdiary">
      <SiteHeader />
      <main className="researchdiary__main cwb__main">{children}</main>
      <ReportFooter />
    </div>
  )
}

function Notice({ children }) {
  return <p className="researchdiary__notice caps-exempt">{children}</p>
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

function Workbench() {
  const pending = useAsync(() => fetchJson('/data/contracts-history/identity/pending.json'), [])
  const overridesQuery = useAsync(async () => {
    const body = await fetchJson('/api/contract-identity')
    return body?.overrides ?? {}
  }, [])

  const [mode, setMode] = useState(MODE_CONFIRM)
  const [groupKey, setGroupKey] = useState(null)
  const [overrides, setOverrides] = useState(null)
  const [sessionResolved, setSessionResolved] = useState(() => new Set())
  const [showReviewed, setShowReviewed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const deckRef = useRef(null)
  const { getToken } = useAuth()

  const effective = overrides ?? overridesQuery.data ?? EMPTY_OVERRIDES
  const rows = pending.data ?? EMPTY_ROWS
  const groups = useMemo(() => buildGroups(rows), [rows])
  const counts = useMemo(() => tierCounts(groups, effective), [groups, effective])
  const resolvedTotal = useMemo(
    () => rows.filter((row) => effective[row.rowKey]).length,
    [rows, effective],
  )

  // A resolved group leaves the rail, except the one you are standing on —
  // otherwise the pane you just acted in would vanish before you could read
  // what it did, and Undo would be unreachable without the reviewed toggle.
  const visible = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.mode === mode &&
          (showReviewed || !isGroupResolved(g, effective) || g.key === groupKey),
      ),
    [groups, mode, showReviewed, effective, groupKey],
  )
  const group = visible.find((g) => g.key === groupKey) ?? visible[0] ?? null
  const selectedKey = group?.key ?? null
  const targetRow = group
    ? (group.rows.find((row) => !effective[row.rowKey]) ?? group.rows[0])
    : null

  const applyPatch = useCallback(
    async (patch) => {
      const keys = Object.keys(patch)
      if (!keys.length || saving) return
      setSaving(true)
      setError(null)
      try {
        const result = await saveContractIdentityPatch(getToken, patch)
        setOverrides(result)
        setSessionResolved((prev) => {
          const next = new Set(prev)
          for (const key of keys) {
            if (patch[key] === null) next.delete(key)
            else next.add(key)
          }
          return next
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    },
    [getToken, saving],
  )

  const step = useCallback(
    (delta) => {
      if (!visible.length) return
      const at = Math.max(0, visible.findIndex((g) => g.key === selectedKey))
      const next = Math.min(visible.length - 1, Math.max(0, at + delta))
      setGroupKey(visible[next].key)
    },
    [visible, selectedKey],
  )

  // The primary action, in one place, so a keystroke and a button can never
  // disagree about what "the primary action" means in a given mode.
  const runPrimary = useCallback(
    (scope) => {
      if (!group || saving) return
      const rowsFor = scope === 'row' ? [targetRow] : group.rows
      if (group.mode === MODE_CONFIRM) {
        if (scope === 'group' && !group.bulk.offered) {
          setError('These rows carry different ids — confirm them one at a time.')
          return
        }
        applyPatch(confirmPatch(rowsFor))
        return
      }
      if (group.mode === MODE_CHOOSE) {
        const top = scope === 'row' ? targetRow?.candidates?.[0] : group.bulk.candidates[0]
        if (top) applyPatch(candidatePatch(rowsFor, top.id))
        return
      }
      applyPatch(dismissPatch(rowsFor))
    },
    [group, targetRow, saving, applyPatch],
  )

  const useAsMatch = useCallback(
    (match) => {
      if (!group) return
      const id = Number(match?.id ?? match?.mlbId ?? match)
      if (!Number.isFinite(id)) return
      // A conflict group has no bulk action at all, so a record picked out of
      // the deck lands on the row in front of the reviewer, not on rows whose
      // ids the matcher already says disagree.
      applyPatch(candidatePatch(group.bulk.offered ? group.rows : [targetRow], id))
    },
    [group, targetRow, applyPatch],
  )

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      if (e.key === 'Escape') {
        if (typing) el.blur()
        else setShortcutsOpen(false)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowDown') step(1)
      else if (e.key === 'ArrowUp') step(-1)
      else if (e.key === 'Enter') {
        // Once a group is settled the primary thing left to do with it is
        // leave it, so the same key carries the reviewer forward.
        if (group && isGroupResolved(group, effective)) step(1)
        else runPrimary(e.shiftKey ? 'row' : 'group')
      } else if (e.key === '?') setShortcutsOpen((open) => !open)
      else if (e.key === '/') {
        deckRef.current?.querySelector('input')?.focus()
      } else if (e.key === 'x' || e.key === 'X') applyPatch(dismissPatch(group ? group.rows : []))
      else if (e.key === 's' || e.key === 'S') step(1)
      else if (/^[1-9]$/.test(e.key)) {
        if (group?.mode !== MODE_CHOOSE) return
        const pick = group.bulk.candidates[Number(e.key) - 1]
        if (pick) applyPatch(candidatePatch(group.rows, pick.id))
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, runPrimary, applyPatch, group, effective])

  if (pending.loading || overridesQuery.loading) return <Notice>Loading the review queue…</Notice>
  if (pending.error) return <Notice>Could not load pending.json — {pending.error.message}</Notice>

  return (
    <div className="cwb">
      <p className="cwb__narrow caps-exempt">
        This page is built for a desktop screen. It still works here, but the queue and the decision
        pane are stacked and the shortcuts need a keyboard.
      </p>

      <TierBar
        mode={mode}
        onMode={setMode}
        counts={counts}
        sessionResolved={sessionResolved.size}
        resolvedTotal={resolvedTotal}
        totalRows={rows.length}
        showReviewed={showReviewed}
        onShowReviewed={setShowReviewed}
        shortcutsOpen={shortcutsOpen}
        onShortcuts={setShortcutsOpen}
      />

      {error && <p className="cwb__error caps-exempt">{error}</p>}

      <div className="cwb__body">
        <ReviewQueue
          groups={visible}
          selectedKey={selectedKey}
          overrides={effective}
          onSelect={setGroupKey}
        />
        <DecisionPane group={group} overrides={effective} saving={saving} onSave={applyPatch} />
      </div>

      <div className="cwb__deck" ref={deckRef}>
        <LookupDeck selectedRow={targetRow} onUseAsMatch={useAsMatch} disabled={saving} />
      </div>
    </div>
  )
}

function ReviewGate() {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded) return <Notice>Checking your access…</Notice>
  if (!isSignedIn) {
    return <Notice>Sign in with an admin account to review contract identity matches.</Notice>
  }
  if (user?.publicMetadata?.role !== 'admin') {
    return <Notice>This account is signed in but does not have the admin role.</Notice>
  }
  return <Workbench />
}

export function ContractIdentityReviewPage() {
  return (
    <Shell>
      {isClerkEnabled ? (
        <ReviewGate />
      ) : (
        <Notice>The contract identity review queue needs sign-in configured on this deploy.</Notice>
      )}
    </Shell>
  )
}
