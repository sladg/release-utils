import { applyStructured } from './structured'
import type { UnknownRecord } from './types'

// JSON files keep their original indentation/trailing newline so the bump is a
// minimal diff rather than a full reformat.
const detectIndent = (text: string): number | string => {
  const match = text.match(/^[ \t]+/m)
  if (!match) return 2
  return match[0].startsWith('\t') ? '\t' : match[0].length
}

const serializeJson = (data: UnknownRecord, original: string) =>
  JSON.stringify(data, null, detectIndent(original)) +
  (original.endsWith('\n') ? '\n' : '')

export const applyJson = applyStructured(
  (text) => JSON.parse(text),
  serializeJson,
)
