import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// The unsaved state of one park's card while the owner is editing it.
//
// DELIBERATELY KNOWS NOTHING ABOUT CLERK, uploading, or /api/copy. It is called
// unconditionally by BallparkCard — for every visitor, admin or not — so it must
// be safe on a deploy with no ClerkProvider mounted. Everything that needs a
// token lives in BallparkAdminBar.jsx, which is only rendered when Clerk is
// configured. Keeping that line clean is what lets the card hold edit state in
// one place while the two halves of the editing UI (the buttons in the blue
// masthead, the fields in the body) sit in different parts of the tree.
//
// NOTHING IS UPLOADED UNTIL SAVE. A chosen image is held here as a File plus a
// local object URL for the preview; the bytes only leave the browser when the
// owner commits. That is what makes Cancel a true cancel — an abandoned edit
// leaves no orphaned object in the blob store and no trace anywhere else — and
// it is why the endpoint deliberately does not touch the copy store itself.

// The six copy fields one park owns, as short names. The dotted ids are built
// from the park key at the edges (`fieldIds` below) so nothing in the UI has to
// know the registry's naming scheme.
const SLOTS = ['name', 'wordmark', 'photo', 'credit', 'focus']

// Click (or tap) the photo to say which part of it must survive the widescreen
// crop. A pair of number boxes would be the obvious control and it is the wrong
// one: "50 20" means nothing until you see what it does, and the person setting
// it is looking straight at the picture. The click position becomes exactly the
// percentage pair the registry already validates, so what this stores is
// identical to what the /admin panel writes by hand.
//
// Lives HERE, beside the draft, rather than in the editor module — the card
// calls it at the top level of every render, and the editor is lazy. A hook
// imported from a lazily-loaded file would drag that file back into the main
// bundle and undo the split.
export function useFocalPick(onChange) {
  return useCallback(
    (event) => {
      const box = event.currentTarget.getBoundingClientRect()
      if (!box.width || !box.height) return
      const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)))
      const x = clamp(((event.clientX - box.left) / box.width) * 100)
      const y = clamp(((event.clientY - box.top) / box.height) * 100)
      onChange(`${x} ${y}`)
    },
    [onChange],
  )
}

export function fieldIds(key) {
  return {
    name: `ballpark.${key}Name`,
    wordmark: `ballpark.${key}Wordmark`,
    photo: `ballpark.${key}Photo`,
    credit: `ballpark.${key}Credit`,
    focus: `ballpark.${key}Focus`,
  }
}

// Takes only the SAVED values, not the park key — the key is what turns a slot
// into a registry id, and that happens at the two edges (the card, the save)
// through fieldIds above. The draft itself deals in short slot names.
export function useBallparkDraft(saved) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(saved)
  // Save progress and the last failure, held HERE rather than in the bar that
  // owns the Save button, because the two are read in different places: the bar
  // disables its buttons on `busy`, and the form under it prints `error` where
  // there is room for a sentence. A blue masthead is the wrong place to explain
  // that a photograph would not compress.
  const [status, setStatus] = useState({ busy: false, error: '' })
  // Chosen-but-not-yet-uploaded files, by slot: { photo: File, wordmark: File }.
  const [files, setFiles] = useState({})
  // Object URLs for those files. Held in a ref as well as state because the
  // cleanup below has to revoke URLs that are no longer in state — reading them
  // out of the render closure would revoke a stale set and leave real leaks.
  const [previews, setPreviews] = useState({})
  // A mirror of `previews` that the unmount cleanup can read. The cleanup runs
  // once, so it closes over the FIRST render's previews — which is always the
  // empty object — and would revoke nothing while every URL created afterwards
  // leaked. The ref is what gives that one cleanup the current set.
  //
  // Written in an effect rather than during render: a ref assignment in the
  // render body is a side effect, which React Compiler rejects outright and
  // which breaks under a re-render that is thrown away. The effect ordering is
  // fine — an unmount cleanup cannot run before the effects of the render that
  // produced the value it needs.
  const previewsRef = useRef(previews)
  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  // Revoke every outstanding object URL when the card unmounts. Without this a
  // few edits on a phone pin several full-size decoded images in memory for the
  // life of the tab.
  useEffect(
    () => () => {
      for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url)
    },
    [],
  )

  const revokeSlot = useCallback((slot) => {
    setPreviews((prev) => {
      if (!prev[slot]) return prev
      URL.revokeObjectURL(prev[slot])
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }, [])

  const start = useCallback(() => {
    setValues(saved)
    setFiles({})
    setStatus({ busy: false, error: '' })
    setEditing(true)
  }, [saved])

  const cancel = useCallback(() => {
    setEditing(false)
    setFiles({})
    setValues(saved)
    setStatus({ busy: false, error: '' })
    setPreviews((prev) => {
      for (const url of Object.values(prev)) URL.revokeObjectURL(url)
      return {}
    })
  }, [saved])

  const setValue = useCallback((slot, value) => {
    setValues((prev) => ({ ...prev, [slot]: value }))
  }, [])

  // Choosing a file supersedes both any previously chosen file for that slot and
  // the saved URL — the URL field is cleared so the preview and the eventual
  // upload cannot disagree about which image is meant.
  const setFile = useCallback(
    (slot, file) => {
      revokeSlot(slot)
      if (!file) {
        setFiles((prev) => {
          const next = { ...prev }
          delete next[slot]
          return next
        })
        return
      }
      setFiles((prev) => ({ ...prev, [slot]: file }))
      setPreviews((prev) => ({ ...prev, [slot]: URL.createObjectURL(file) }))
    },
    [revokeSlot],
  )

  // Clear a slot outright: no file, no URL, back to whatever ships by default.
  const clearSlot = useCallback(
    (slot) => {
      revokeSlot(slot)
      setFiles((prev) => {
        const next = { ...prev }
        delete next[slot]
        return next
      })
      setValues((prev) => ({ ...prev, [slot]: '' }))
    },
    [revokeSlot],
  )

  // Adopt what the server stored. Called after a successful save so the draft
  // stops being "unsaved" — otherwise Cancel would later revert to the values
  // this edit replaced.
  const commit = useCallback((stored) => {
    setValues(stored)
    setFiles({})
    setEditing(false)
    setStatus({ busy: false, error: '' })
    setPreviews((prev) => {
      for (const url of Object.values(prev)) URL.revokeObjectURL(url)
      return {}
    })
  }, [])

  // What the card should render RIGHT NOW: the draft while editing (with local
  // previews standing in for images not yet uploaded), the saved values
  // otherwise. One object, so the card's render path is identical either way and
  // there is no second layout that only admins ever see.
  const shown = useMemo(() => {
    if (!editing) return saved
    return {
      ...values,
      photo: previews.photo || values.photo,
      wordmark: previews.wordmark || values.wordmark,
    }
  }, [editing, saved, values, previews])

  const dirty = useMemo(
    () => Object.keys(files).length > 0 || SLOTS.some((slot) => (values[slot] || '') !== (saved[slot] || '')),
    [files, values, saved],
  )

  return {
    editing,
    values,
    files,
    shown,
    dirty,
    status,
    setStatus,
    start,
    cancel,
    commit,
    setValue,
    setFile,
    clearSlot,
  }
}
