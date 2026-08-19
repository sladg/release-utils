import type { UnknownRecord, VersionApplier } from './types'

import { is } from '@sladg/what-that'

// Sets the version at an exact key-path only when the path already resolves to
// a string. Never creates keys and never recurses, so nested dependency
// versions (which live under different paths) are untouched even when they
// share the app's version — see issue #2.
const setVersionAtPath = (
  root: UnknownRecord,
  path: string[],
  version: string,
): boolean => {
  let node: UnknownRecord = root
  for (const key of path.slice(0, -1)) {
    const next = node[key]
    if (!is.object(next)) return false
    node = next
  }
  const leaf = path.at(-1)
  if (leaf === undefined) return false
  if (!is.string(node[leaf]) || node[leaf] === version) return false
  node[leaf] = version
  return true
}

// Shared engine for object-shaped formats: parse → set paths → re-serialize.
const applyStructured =
  (
    parse: (text: string) => unknown,
    serialize: (data: UnknownRecord, original: string) => string,
  ): VersionApplier =>
  (text, paths, version) => {
    const parsed: unknown = parse(text)
    if (!is.object(parsed)) return { content: text, changed: false }

    const changed = paths
      .map((path) => setVersionAtPath(parsed, path, version))
      .some(Boolean)

    if (!changed) return { content: text, changed }
    return { content: serialize(parsed, text), changed }
  }

export { setVersionAtPath, applyStructured }
