// Minimal RFC 6902 (JSON Patch) applier. Generic — no baseball/feed knowledge
// lives here; see api/game.js for the diffPatch-specific merge + sanity check.
//
// IMMUTABLE BY CONTRACT: applyJsonPatch never mutates `base` — it clones once
// and returns a new root. This is load-bearing, not a style preference:
// useRevealProgress.js's derived-data cache invalidates on feed object
// IDENTITY (ADR-0007), so an in-place patcher would leave that cache
// serving stale reveals after every poll. Verified against a real MLB feed's
// diffPatch stream (op set: add/remove/replace/move/copy — see
// .scratch/live-feed-diffpatch/findings.md); `test` is implemented too since
// the wire format carries no documented contract on which ops can appear.

function unescapePointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~')
}

function parsePointer(pointer) {
  if (pointer === '') return []
  if (!pointer.startsWith('/')) throw new Error(`Invalid JSON Pointer: ${pointer}`)
  return pointer.slice(1).split('/').map(unescapePointerToken)
}

function getIn(root, tokens) {
  let node = root
  for (const token of tokens) {
    if (node == null) return undefined
    node = Array.isArray(node) ? node[token === '-' ? node.length - 1 : Number(token)] : node[token]
  }
  return node
}

function setAt(container, token, value) {
  if (Array.isArray(container)) {
    container.splice(token === '-' ? container.length : Number(token), 0, value)
  } else {
    container[token] = value
  }
}

function removeAt(container, token) {
  if (Array.isArray(container)) {
    return container.splice(token === '-' ? container.length - 1 : Number(token), 1)[0]
  }
  const value = container[token]
  delete container[token]
  return value
}

function replaceAt(container, token, value) {
  if (Array.isArray(container)) {
    container[token === '-' ? container.length - 1 : Number(token)] = value
  } else {
    container[token] = value
  }
}

function applyOp(root, op) {
  const tokens = parsePointer(op.path)
  const lastToken = tokens[tokens.length - 1]
  const parent = tokens.length === 0 ? undefined : getIn(root, tokens.slice(0, -1))

  switch (op.op) {
    case 'add':
      if (tokens.length === 0) return op.value
      setAt(parent, lastToken, structuredClone(op.value))
      return root
    case 'remove':
      removeAt(parent, lastToken)
      return root
    case 'replace':
      if (tokens.length === 0) return structuredClone(op.value)
      replaceAt(parent, lastToken, structuredClone(op.value))
      return root
    case 'move': {
      const fromTokens = parsePointer(op.from)
      const fromParent = getIn(root, fromTokens.slice(0, -1))
      const value = removeAt(fromParent, fromTokens[fromTokens.length - 1])
      setAt(parent, lastToken, value)
      return root
    }
    case 'copy': {
      const fromTokens = parsePointer(op.from)
      setAt(parent, lastToken, structuredClone(getIn(root, fromTokens)))
      return root
    }
    case 'test': {
      const actual = getIn(root, tokens)
      if (JSON.stringify(actual) !== JSON.stringify(op.value)) {
        throw new Error(`JSON Patch test op failed at ${op.path}`)
      }
      return root
    }
    default:
      throw new Error(`Unsupported JSON Patch op: ${op.op}`)
  }
}

// Applies a list of RFC 6902 ops to `base` and returns a NEW root object;
// `base` itself is left untouched. Throws on a malformed/unsupported op —
// callers that need a resilient merge (e.g. the diffPatch feed poller)
// should catch and fall back rather than trust a partial apply.
export function applyJsonPatch(base, ops) {
  let root = structuredClone(base)
  for (const op of ops) {
    root = applyOp(root, op)
  }
  return root
}
