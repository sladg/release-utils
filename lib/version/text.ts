import type { VersionApplier } from './types'

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Free-form sources (e.g. Python __version__) have no parser; anchor on the
// identifier name so we never depend on the previous version value.
export const applyText: VersionApplier = (text, paths, version) => {
  const patterns = paths.map(
    (path) =>
      new RegExp(
        `(${escapeRegExp(path[path.length - 1])}\\s*=\\s*)(['"])([^'"]*)\\2`,
        'g',
      ),
  )
  const content = patterns.reduce(
    (acc, pattern) => acc.replace(pattern, `$1$2${version}$2`),
    text,
  )
  return { content, changed: content !== text }
}
