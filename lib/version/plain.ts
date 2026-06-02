import type { VersionApplier } from './types'

// Whole-file version (VERSION, version.txt). Only replace when the existing
// content already looks like a version, so files that happen to be named
// VERSION but hold something else (codenames, notes) are left untouched.
const VERSION_SHAPE = /^\s*v?\d+\.\d+\.\d+/

export const applyPlain: VersionApplier = (text, _paths, version) => {
  if (!VERSION_SHAPE.test(text)) return { content: text, changed: false }
  const content = `${version}${text.endsWith('\n') ? '\n' : ''}`
  return { content, changed: content !== text }
}
