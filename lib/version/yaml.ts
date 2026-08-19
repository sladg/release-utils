import type { VersionApplier } from './types'
import { parseDocument } from 'yaml'

// YAML keeps comments/formatting via the document model (setIn mutates in place).
const applyPaths = (doc: ReturnType<typeof parseDocument>, paths: string[][], version: string) =>
  paths
    .map((path) => {
      if (!doc.hasIn(path)) return false
      doc.setIn(path, version)
      return true
    })
    .some(Boolean)

const applyYaml: VersionApplier = (text, paths, version) => {
  const doc = parseDocument(text)
  const changed = applyPaths(doc, paths, version)
  if (!changed) return { content: text, changed }
  return { content: doc.toString(), changed }
}

export { applyPaths, applyYaml }
