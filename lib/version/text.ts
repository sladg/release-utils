import type { VersionApplier } from './types'

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)

// Free-form sources (Python __version__, mix.exs, gradle, gemspecs, RPM specs)
// have no parser; anchor on the identifier so we never depend on the previous
// version value. `.` is allowed before the identifier so `spec.version` matches
// while `myversion` does not.
const anchor = (name: string) => String.raw`(?<![\w-])${escapeRegExp(name)}\s*[:=]\s*`

const quoted = (name: string) => new RegExp(`(${anchor(name)})(['"])([^'"]*)\\2`, 'gu')

// Bare values only when what is already there looks like a version, so
// `version = project.version` and similar indirections are left alone.
const bare = (name: string) => new RegExp(`(${anchor(name)})v?\\d[\\w.+-]*`, 'gu')

const applyText: VersionApplier = (text, paths, version) => {
  const content = paths.reduce((acc, path) => {
    const name = path.at(-1)
    if (name === undefined) return acc
    return acc
      .replace(quoted(name), `$1$2${version}$2`)
      .replace(bare(name), `$1${version}`)
  }, text)
  return { content, changed: content !== text }
}

export { applyText }
