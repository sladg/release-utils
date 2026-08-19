import type { UnknownRecord } from './types'
import { applyStructured } from './structured'

// JSON files keep their original indentation/trailing newline so the bump is a
// minimal diff rather than a full reformat.
const detectIndent = (text: string): number | string => {
  const match = /^[ \t]+/mu.exec(text)
  if (!match) return 2
  if (match[0].startsWith('\t')) return '\t'
  return match[0].length
}

const serializeJson = (data: UnknownRecord, original: string) => {
  const serialized = JSON.stringify(data, null, detectIndent(original))
  if (original.endsWith('\n')) return `${serialized}\n`
  return serialized
}

const applyJson = applyStructured(
  (text) => JSON.parse(text),
  serializeJson,
)

export { applyJson }
