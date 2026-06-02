import type { UnknownRecord, VersionApplier } from './types'

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Sets the version at an exact key-path only when the path already resolves to
// a string. Never creates keys and never recurses, so nested dependency
// versions (which live under different paths) are untouched even when they
// share the app's version — see issue #2.
export const setVersionAtPath = (
  root: UnknownRecord,
  path: string[],
  version: string,
): boolean => {
  let node: UnknownRecord = root
  for (const key of path.slice(0, -1)) {
    const next = node[key]
    if (!isRecord(next)) return false
    node = next
  }
  const leaf = path[path.length - 1]
  if (typeof node[leaf] !== 'string' || node[leaf] === version) return false
  node[leaf] = version
  return true
}

// Shared engine for object-shaped formats: parse → set paths → re-serialize.
export const applyStructured =
  (
    parse: (text: string) => unknown,
    serialize: (data: UnknownRecord, original: string) => string,
  ): VersionApplier =>
  (text, paths, version) => {
    const parsed: unknown = parse(text)
    if (!isRecord(parsed)) return { content: text, changed: false }

    const changed = paths
      .map((path) => setVersionAtPath(parsed, path, version))
      .some(Boolean)

    return { content: changed ? serialize(parsed, text) : text, changed }
  }
