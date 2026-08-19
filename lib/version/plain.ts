import type { VersionApplier } from './types'

// Whole-file version (VERSION, version.txt). Only replace when the existing
// content already looks like a version, so files that happen to be named
// VERSION but hold something else (codenames, notes) are left untouched.
const VERSION_SHAPE = /^\s*v?\d+\.\d+\.\d+/u

const applyPlain: VersionApplier = (text, _paths, version) => {
  if (!VERSION_SHAPE.test(text)) return { content: text, changed: false }
  let content = version
  if (text.endsWith('\n')) content += '\n'
  return { content, changed: content !== text }
}

export { applyPlain }
