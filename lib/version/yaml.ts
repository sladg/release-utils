import { parseDocument } from 'yaml'

import type { VersionApplier } from './types'

// YAML keeps comments/formatting via the document model (setIn mutates in place).
export const applyYaml: VersionApplier = (text, paths, version) => {
  const doc = parseDocument(text)
  const changed = paths
    .map((path) => {
      if (!doc.hasIn(path)) return false
      doc.setIn(path, version)
      return true
    })
    .some(Boolean)

  return { content: changed ? doc.toString() : text, changed }
}
