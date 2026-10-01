// A localStorage stand-in for tests. `key(i)` is positional over insertion
// order and a removal RE-INDEXES everything after it — the trap a sweep that
// removes while iterating falls into. Options make it fail on demand:
//   throwOnGet   getItem throws        throwOnSet  setItem and removeItem throw
//   throwOnRead  length and key throw  refuse(k)   removeItem(k) throws when true
export function fakeStorage(seed = {}, { throwOnGet = false, throwOnSet = false, throwOnRead = false, refuse = () => false } = {}) {
  const data = { ...seed }
  return {
    data,
    get length() {
      if (throwOnRead) throw new Error('SecurityError')
      return Object.keys(data).length
    },
    key(i) {
      if (throwOnRead) throw new Error('SecurityError')
      return Object.keys(data)[i] ?? null
    },
    getItem(k) {
      if (throwOnGet) throw new Error('SecurityError')
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null
    },
    setItem(k, v) {
      if (throwOnSet) throw new Error('QuotaExceededError')
      data[k] = String(v)
    },
    removeItem(k) {
      if (throwOnSet || refuse(k)) throw new Error('QuotaExceededError')
      delete data[k]
    },
  }
}
