// Immutable RFC 6902 applier for the #2578 spike. Never mutates its input and
// always returns a NEW root object, even for an empty patch. ADR-0007 and
// useRevealProgress.js key a cache on root identity, so a patcher that hands
// back the object it was given would silently skip a re-derive.
import { isDeepStrictEqual } from 'node:util'

const unesc = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~')
const isObj = (v) => v !== null && typeof v === 'object'

function keysOf(ptr) {
  if (ptr === '') return []
  if (ptr[0] !== '/') throw new Error('bad pointer')
  return ptr.slice(1).split('/').map(unesc)
}

function getAt(doc, keys) {
  let v = doc
  for (const k of keys) {
    if (!isObj(v) || !(k in v)) throw new Error('path not found')
    v = v[k]
  }
  return v
}

function index(arr, k, max, allowDash) {
  if (k === '-' && allowDash) return arr.length
  const n = Number(k)
  if (!/^\d+$/.test(k) || n > max) throw new Error('bad index')
  return n
}

const add = (value) => (c, k) => {
  if (Array.isArray(c)) c.splice(index(c, k, c.length, true), 0, value)
  else c[k] = value
}
const replace = (value) => (c, k) => {
  if (Array.isArray(c)) c[index(c, k, c.length - 1, false)] = value
  else if (k in c) c[k] = value
  else throw new Error('path not found')
}
const remove = (c, k) => {
  if (Array.isArray(c)) c.splice(index(c, k, c.length - 1, false), 1)
  else if (k in c) delete c[k]
  else throw new Error('path not found')
}

// Copy every node along the pointer, hand the copied parent to `leaf`.
function edit(node, keys, i, leaf) {
  if (!isObj(node)) throw new Error('path not found')
  const k = keys[i]
  const copy = Array.isArray(node) ? node.slice() : { ...node }
  if (i === keys.length - 1) leaf(copy, k)
  else {
    if (!(k in node)) throw new Error('path not found')
    copy[k] = edit(node[k], keys, i + 1, leaf)
  }
  return copy
}

function applyOp(doc, op) {
  const to = keysOf(op.path)
  switch (op.op) {
    case 'add':
      return to.length ? edit(doc, to, 0, add(op.value)) : op.value
    case 'replace':
      return to.length ? edit(doc, to, 0, replace(op.value)) : op.value
    case 'remove':
      if (!to.length) throw new Error('cannot remove the root')
      return edit(doc, to, 0, remove)
    case 'move': {
      const from = keysOf(op.from)
      const value = getAt(doc, from)
      const without = edit(doc, from, 0, remove)
      return to.length ? edit(without, to, 0, add(value)) : value
    }
    case 'copy': {
      const value = getAt(doc, keysOf(op.from))
      return to.length ? edit(doc, to, 0, add(value)) : value
    }
    case 'test':
      if (!isDeepStrictEqual(getAt(doc, to), op.value)) throw new Error('test failed')
      return doc
    default:
      throw new Error(`unknown op ${op.op}`)
  }
}

export function applyPatch(doc, ops) {
  let d = doc
  for (const op of ops) d = applyOp(d, op)
  return d === doc ? (Array.isArray(doc) ? doc.slice() : { ...doc }) : d
}
